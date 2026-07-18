import React, { useRef, useEffect } from 'react'
import './modelviewer.css'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function ModelViewer({ src = '/futuristic_flying_animated_robot_-_low_poly/scene.gltf', gltfScale = 1.4, gltfYOffset = 0.35, modelXOffset = 0, modelZOffset = 0, enableControls = true, enableAutoRotate = false }){
  const mountRef = useRef(null)
  const mixerRef = useRef(null)
  const reqRef = useRef(null)

  useEffect(()=>{
    const mount = mountRef.current
    if(!mount) return

    // basic WebGL check
    if(!window.WebGLRenderingContext){
      // no WebGL, nothing we can do
      return
    }

    const scene = new THREE.Scene()
    scene.background = null

    const clock = new THREE.Clock()

    const w = mount.clientWidth || 600
    const h = mount.clientHeight || 480
    const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 1000)
    camera.position.set(0, 1.4, 3.6)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w,h)
    mount.appendChild(renderer.domElement)

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    hemi.position.set(0, 20, 0)
    scene.add(hemi)

    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(3,10,10)
    scene.add(dir)

  let model = null
  let controls = null

    const loader = new GLTFLoader()
    loader.load(src, (gltf)=>{
      model = gltf.scene || gltf.scenes?.[0]
      if(!model) return

      // scale
      model.scale.setScalar(gltfScale)

      model.traverse((c)=>{
        if(c.isMesh){
          c.castShadow = true
          c.receiveShadow = true
        }
      })

      // center
      try{
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
      }catch(e){/* ignore */}

  // lift slightly
  model.position.y += gltfYOffset
  // horizontal and forward offsets so model can overlay the text if desired
  model.position.x += modelXOffset
  model.position.z += modelZOffset

  scene.add(model)

      // animations
      if(gltf.animations && gltf.animations.length){
        const mixer = new THREE.AnimationMixer(model)
        mixerRef.current = mixer
        gltf.animations.forEach((clip)=>{
          const action = mixer.clipAction(clip)
          action.play()
        })
      }
    }, undefined, (err)=>{
      console.error('GLTF load error', err)
    })

    // setup orbit controls (optional)
    if(enableControls){
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.07
      controls.enablePan = false
      controls.enableRotate = true
      controls.minDistance = 1.2
      controls.maxDistance = 8
      // limit vertical rotation so model doesn't flip under the ground
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI / 2.1
      // reduce rotate speed slightly for smoother feel
      controls.rotateSpeed = 0.6
    }

    function animate(){
      const delta = clock.getDelta()
      if(mixerRef.current) mixerRef.current.update(delta)
      if(controls) controls.update()
      // only auto-rotate when explicitly enabled; otherwise model is static until user interaction
      if(enableAutoRotate && model) model.rotation.y += delta * 0.2
      renderer.render(scene, camera)
      reqRef.current = requestAnimationFrame(animate)
    }
    animate()

    function onResize(){
      const w = mount.clientWidth || 600
      const h = mount.clientHeight || 480
      camera.aspect = w/h
      camera.updateProjectionMatrix()
      renderer.setSize(w,h)
    }
    window.addEventListener('resize', onResize)

    return ()=>{
      window.removeEventListener('resize', onResize)
      if(reqRef.current) cancelAnimationFrame(reqRef.current)
      if(mixerRef.current) mixerRef.current.stopAllAction()
      if(controls){
        try{ controls.dispose() }catch(e){}
      }
      renderer.dispose()
      try{ mount.removeChild(renderer.domElement) }catch(e){}
    }
  }, [src, gltfScale, gltfYOffset])

  return (
    <div className="model-viewer" ref={mountRef} aria-hidden>
      {/* three.js canvas will be appended here */}
    </div>
  )
}
