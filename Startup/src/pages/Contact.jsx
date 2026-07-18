import React, { useState, useEffect } from 'react';
import '../App.css';
import './contact.css';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    // Add entrance animations
    const elements = document.querySelectorAll('.contact-item, .contact-form-container');
    elements.forEach((el, index) => {
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 100);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear status when user starts typing again
    if (status.message) {
      setStatus({ type: '', message: '' });
    }
  };

  const handleFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const handleBlur = () => {
    setFocusedField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    // Basic validation
    if (!formData.name || !formData.email || !formData.message) {
      setStatus({
        type: 'error',
        message: 'Please fill in all required fields'
      });
      setIsSubmitting(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid email address'
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setStatus({
        type: 'success',
        message: 'Thank you for reaching out! We will get back to you shortly.'
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: ''
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Something went wrong. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="contact-page">
      <div className="contact-hero">
        <div className="contact-hero-bg"></div>
        <div className="contact-hero-content">
          <h1 className="contact-title">
            <span className="title-gradient">Get in Touch</span>
          </h1>
          <p className="contact-subtitle">
            Have questions about MindSync? We'd love to hear from you. Our team is always here to help and provide you with the best possible support.
          </p>
        </div>
      </div>

      <div className="contact-container">
        <div className="contact-info">
          <div className="info-header">
            <h2 className="info-title">Let's Connect</h2>
            <p className="info-description">
              Reach out through any of these channels. We're here to help you succeed with MindSync.
            </p>
          </div>

          <div className="contact-details">
            <div className="contact-item" data-aos="fade-up" data-aos-delay="100">
              <div className="contact-icon-wrapper">
                <div className="contact-icon">
                  <FaPhone />
                </div>
                <div className="icon-glow"></div>
              </div>
              <div className="contact-item-content">
                <h3>Call Us</h3>
                <p>+91 8264131474</p>
                <span className="contact-label">Available 24/7</span>
              </div>
            </div>

            <div className="contact-item" data-aos="fade-up" data-aos-delay="200">
              <div className="contact-icon-wrapper">
                <div className="contact-icon">
                  <FaEnvelope />
                </div>
                <div className="icon-glow"></div>
              </div>
              <div className="contact-item-content">
                <h3>Email Us</h3>
                <p>nikhilpalyal6@gmail.com</p>
                <span className="contact-label">Response within 24h</span>
              </div>
            </div>

            <div className="contact-item" data-aos="fade-up" data-aos-delay="300">
              <div className="contact-icon-wrapper">
                <div className="contact-icon">
                  <FaMapMarkerAlt />
                </div>
                <div className="icon-glow"></div>
              </div>
              <div className="contact-item-content">
                <h3>Visit Us</h3>
                <p>123 Innovation Street, Tech City</p>
                <span className="contact-label">Mon-Fri 9AM-6PM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="contact-form-container" data-aos="fade-up" data-aos-delay="400">
          <div className="form-header">
            <h2 className="form-title">Send us a Message</h2>
            <p className="form-subtitle">Fill out the form below and we'll get back to you as soon as possible.</p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className={`form-group ${focusedField === 'name' ? 'focused' : ''} ${formData.name ? 'has-value' : ''}`}>
              <label htmlFor="name">
                Full Name <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => handleFocus('name')}
                  onBlur={handleBlur}
                  placeholder="John Doe"
                  required
                />
                <div className="input-border"></div>
              </div>
            </div>

            <div className={`form-group ${focusedField === 'email' ? 'focused' : ''} ${formData.email ? 'has-value' : ''}`}>
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => handleFocus('email')}
                  onBlur={handleBlur}
                  placeholder="john@example.com"
                  required
                />
                <div className="input-border"></div>
              </div>
            </div>

            <div className={`form-group ${focusedField === 'phone' ? 'focused' : ''} ${formData.phone ? 'has-value' : ''}`}>
              <label htmlFor="phone">
                Phone Number <span className="optional-label">(Optional)</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onFocus={() => handleFocus('phone')}
                  onBlur={handleBlur}
                  placeholder="+1 (234) 567-8900"
                />
                <div className="input-border"></div>
              </div>
            </div>

            <div className={`form-group ${focusedField === 'message' ? 'focused' : ''} ${formData.message ? 'has-value' : ''}`}>
              <label htmlFor="message">
                Message <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onFocus={() => handleFocus('message')}
                  onBlur={handleBlur}
                  placeholder="Tell us how we can help you..."
                  required
                />
                <div className="input-border"></div>
              </div>
            </div>

            <button
              type="submit"
              className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              <span className="btn-content">
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <FaPaperPlane className="btn-icon" />
                  </>
                )}
              </span>
              <div className="btn-shine"></div>
            </button>

            {status.message && (
              <div className={`status-message ${status.type}-message`}>
                {status.type === 'success' ? (
                  <FaCheckCircle className="status-icon" />
                ) : (
                  <FaExclamationCircle className="status-icon" />
                )}
                <span>{status.message}</span>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="map-section">
        <div className="map-header">
          <h2 className="map-title">Find Us</h2>
          <p className="map-subtitle">Visit our office or explore the area</p>
        </div>
        <div className="map-container">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2969.654246115649!2d-87.64678384911374!3d41.89027237922154!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDHCsDUzJzI1LjAiTiA4N8KwMzgnMzcuMCJX!5e0!3m2!1sen!2sus!4v1635786982000!5m2!1sen!2sus"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            title="MindSync Location"
          ></iframe>
          <div className="map-overlay"></div>
        </div>
      </div>
    </main>
  )
}
