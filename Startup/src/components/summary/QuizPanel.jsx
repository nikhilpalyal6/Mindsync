import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  HelpCircle,
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  AlertCircle, 
  Bookmark, 
  BookOpen, 
  Check, 
  X,
  Clock,
  Award,
  BarChart2,
  Info,
  TrendingUp,
  RotateCcw,
  Sliders,
  Play,
  Layers,
  Search,
  Map,
  Calendar,
  Layers2
} from 'lucide-react';
import { getQuiz, generateQuiz, updateQuestionState, generateExplanation, getExplanations } from '../../services/api';

export const QuizPanel = React.memo(({ session, resourceId, resourceType }) => {
  const studySessionId = session?._id;

  // Active Quiz State
  const [questions, setQuestions] = useState([]);
  const [originalQuestions, setOriginalQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [explanationsList, setExplanationsList] = useState([]);
  const [generatingExplain, setGeneratingExplain] = useState(false);

  const [explanation, setExplanation] = useState(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState(null);

  useEffect(() => {
    setExplanation(null);
    setIsExplanationLoading(false);
    setExplanationError(null);
    if (questions[currentIndex]) {
      setSelectedAnswer(questions[currentIndex].selectedAnswer || '');
      setShowExplanation(questions[currentIndex].attempted || false);
    } else {
      setSelectedAnswer('');
      setShowExplanation(false);
    }
  }, [currentIndex]);

  const loadExplanations = useCallback(async () => {
    if (!resourceId || !studySessionId) return;
    try {
      const res = await getExplanations(resourceId, studySessionId);
      if (res?.success && Array.isArray(res.data)) {
        setExplanationsList(res.data);
      }
    } catch (err) {
      console.error('Failed to load explanations:', err);
    }
  }, [resourceId, studySessionId]);

  useEffect(() => {
    loadExplanations();
  }, [loadExplanations]);
  
  // Dashboard & Configuration States
  const [quizType, setQuizType] = useState('Mixed');
  const [difficulty, setDifficulty] = useState('Mixed');
  const [questionCount, setQuestionCount] = useState('Auto');
  const [selectedTopic, setSelectedTopic] = useState('Entire Resource');
  const [attemptMode, setAttemptMode] = useState('practice');
  const [learningGoal, setLearningGoal] = useState('Understand Concepts');

  // Launch states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [quizMetadata, setQuizMetadata] = useState(null);

  const [quizMode, setQuizMode] = useState('practice');
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Timer
  const [timeTaken, setTimeTaken] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  // Current Question UI State
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  // Attempt Analytics
  const [attemptAnalytics, setAttemptAnalytics] = useState(null);

  // Scan dynamic topics from other workspace resources
  const availableTopics = React.useMemo(() => {
    const topicsSet = new Set(['Entire Resource']);
    if (session?.resources) {
      const res = session.resources.find(r => r._id === resourceId || r.url === resourceId);
      if (res) {
        if (res.ai?.flashcards?.cards) {
          res.ai.flashcards.cards.forEach(c => {
            if (c.topic) topicsSet.add(c.topic);
          });
        }
        if (res.ai?.quiz?.questions) {
          res.ai.quiz.questions.forEach(q => {
            if (q.topic) topicsSet.add(q.topic);
          });
        }
        if (res.ai?.summary?.keyTakeaways) {
          res.ai.summary.keyTakeaways.forEach(k => {
            if (k.topic) topicsSet.add(k.topic);
          });
        }
      }
    }
    if (session?.metadata) {
      const meta = session.metadata;
      if (meta.youtube?.chapters) {
        meta.youtube.chapters.forEach(c => {
          if (c.title) topicsSet.add(c.title);
        });
      }
    }
    return Array.from(topicsSet);
  }, [session, resourceId]);

  // Fetch cached quiz on mount
  const loadQuiz = useCallback(async () => {
    if (!studySessionId || !resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getQuiz(studySessionId, resourceId);
      if (res && res.found && res.questions?.length > 0) {
        setQuestions(res.questions);
        setOriginalQuestions(res.questions);
        setQuizMetadata(res.quiz);
      } else {
        setQuestions([]);
        setOriginalQuestions([]);
        setQuizMetadata(null);
      }

      // Auto-populate preferences if they exist
      if (res && res.preferences) {
        setQuizType(res.preferences.quizType || 'Mixed');
        setDifficulty(res.preferences.difficulty || 'Mixed');
        setQuestionCount(res.preferences.questionCount || '10');
        setAttemptMode(res.preferences.attemptMode || 'practice');
        setLearningGoal(res.preferences.learningGoal || 'Understand Concepts');
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
      setError(err.message || 'Failed to fetch quiz.');
    } finally {
      setLoading(false);
    }
  }, [studySessionId, resourceId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Track loading to avoid saving initial preferences values on mount
  const hasLoadedPreferences = useRef(false);
  useEffect(() => {
    if (loading) return;
    
    // Set hasLoadedPreferences to true once first loading finishes
    if (!hasLoadedPreferences.current) {
      hasLoadedPreferences.current = true;
      return;
    }

    const savePreferences = async () => {
      try {
        await updateQuestionState(resourceId, 'preferences', {
          studySessionId,
          preferences: {
            quizType,
            difficulty,
            questionCount,
            attemptMode,
            learningGoal
          }
        });
      } catch (err) {
        console.error('Failed to auto-save quiz preferences:', err);
      }
    };

    const delayDebounce = setTimeout(() => {
      savePreferences();
    }, 800);

    return () => clearTimeout(delayDebounce);
  }, [quizType, difficulty, questionCount, attemptMode, learningGoal, studySessionId, resourceId, loading]);

  // Timer Effect
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeTaken(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive]);

  // Format MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Generate / Launch Quiz
  const handleGenerate = async (forceRegenerate = false, overrides = {}) => {
    if (loading) return; // Prevent duplicate API calls
    if (!studySessionId || !resourceId || !resourceType) return;
    setLoading(true);
    setError(null);
    setQuizStarted(false);
    setQuizCompleted(false);
    setTimerActive(false);
    setTimeTaken(0);

    const activeType = overrides.quizType !== undefined ? overrides.quizType : quizType;
    const activeDiff = overrides.difficulty !== undefined ? overrides.difficulty : difficulty;
    const activeCount = overrides.questionCount !== undefined ? overrides.questionCount : questionCount;
    const activeTopic = overrides.topic !== undefined ? overrides.topic : selectedTopic;
    const activeMode = overrides.attemptMode !== undefined ? overrides.attemptMode : attemptMode;
    const activeGoal = overrides.learningGoal !== undefined ? overrides.learningGoal : learningGoal;

    try {
      const res = await generateQuiz({
        studySessionId,
        resourceId,
        resourceType,
        forceRegenerate,
        quizType: activeType,
        difficulty: activeDiff,
        questionCount: activeCount,
        topic: activeTopic,
        attemptMode: activeMode,
        learningGoal: activeGoal
      });
      if (res && res.questions) {
        setQuestions(res.questions);
        setOriginalQuestions(res.questions);
        setQuizMetadata(res.quiz);
        setCurrentIndex(0);

        // Start Quiz instantly
        setQuizMode(activeMode);
        setQuizStarted(true);
        setTimerActive(true);
        setSelectedAnswer('');
        setShowExplanation(false);
      } else {
        throw new Error('AI service failed to return questions.');
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      setError(err.message || 'Quiz generation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle selected option inputs
  const handleSelectOption = (value) => {
    if (questions[currentIndex]?.attempted && quizMode === 'practice') return;
    setSelectedAnswer(value);
  };

  // Submit Answer
  const submitAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !selectedAnswer.trim()) return;

    const isCorrect = selectedAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      ...currentQuestion,
      attempted: true,
      selectedAnswer,
      isCorrect
    };
    setQuestions(updatedQuestions);

    if (quizMode === 'practice') {
      setShowExplanation(true);
    }

    try {
      await updateQuestionState(resourceId, currentQuestion.id, {
        studySessionId,
        selectedAnswer,
        attempted: true,
        isCorrect
      });
    } catch (err) {
      console.error('Failed to update question state:', err);
    }
  };

  const handleExplainAnswer = async () => {
    const q = questions[currentIndex];
    if (!q || !q.attempted) return;

    const concept = q.explanation || q.question;
    if (!concept || !concept.trim()) {
      setExplanationError("This question does not contain enough information to generate an explanation.");
      return;
    }

    setIsExplanationLoading(true);
    setExplanationError(null);

    const existing = explanationsList.find(
      ex => ex.concept.toLowerCase() === concept.toLowerCase()
    );

    if (existing) {
      setExplanation(existing);
      setIsExplanationLoading(false);
      return;
    }

    try {
      const res = await generateExplanation({
        concept,
        question: q.question,
        answer: q.correctAnswer,
        topic: q.topic || 'General',
        resourceId,
        resourceType,
        studySessionId,
        difficulty: q.difficulty || 'Medium'
      });

      if (res && res.concept) {
        setExplanationsList(prev => [...prev, res]);
        setExplanation(res);
      } else {
        setExplanationError("Unable to explain this answer right now.");
      }
    } catch (err) {
      console.error("Failed to generate quiz explanation:", err);
      setExplanationError("Unable to explain this answer right now.");
    } finally {
      setIsExplanationLoading(false);
    }
  };

  // Navigate Skip question
  const skipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Finish quiz attempt and compile final analytics
  const completeQuiz = async () => {
    setTimerActive(false);

    const totalQuestions = questions.length;
    const attemptedQuestions = questions.filter(q => q.attempted);
    const correctQuestions = questions.filter(q => q.attempted && q.isCorrect);

    const attemptedCount = attemptedQuestions.length;
    const correctCount = correctQuestions.length;
    const wrongCount = attemptedCount - correctCount;
    const skippedCount = totalQuestions - attemptedCount;

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const score = correctQuestions.reduce((acc, q) => acc + (q.points || 10), 0);

    // Compute Topic breakdowns
    const topicBreakdown = {};
    questions.forEach(q => {
      if (!topicBreakdown[q.topic]) {
        topicBreakdown[q.topic] = { total: 0, correct: 0 };
      }
      topicBreakdown[q.topic].total += 1;
      if (q.isCorrect) {
        topicBreakdown[q.topic].correct += 1;
      }
    });

    const weakTopics = Object.keys(topicBreakdown).filter(topic => {
      const stats = topicBreakdown[topic];
      return (stats.correct / stats.total) < 0.6;
    });

    let performanceSummary = 'Needs Improvement';
    if (accuracy >= 85) performanceSummary = 'Excellent';
    else if (accuracy >= 65) performanceSummary = 'Good';

    const analytics = {
      score,
      percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
      correctCount,
      wrongCount,
      skippedCount,
      timeTaken,
      accuracy,
      performanceSummary,
      weakTopics,
      topicBreakdown
    };

    setAttemptAnalytics(analytics);
    setQuizCompleted(true);

    try {
      const res = await updateQuestionState(resourceId, 'complete', {
        studySessionId,
        questions,
        timeTaken
      });
      if (res && res.quiz) {
        setQuizMetadata(res.quiz);
      }
    } catch (err) {
      console.error('Failed to submit final attempt progress:', err);
    }
  };

  // Toggle bookmarking
  const handleBookmarkToggle = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;
    const newBookmarked = !currentQuestion.bookmarked;

    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      ...currentQuestion,
      bookmarked: newBookmarked
    };
    setQuestions(updatedQuestions);

    const updatedOriginal = originalQuestions.map(q => 
      q.id === currentQuestion.id ? { ...q, bookmarked: newBookmarked } : q
    );
    setOriginalQuestions(updatedOriginal);

    try {
      await updateQuestionState(resourceId, currentQuestion.id, {
        studySessionId,
        bookmarked: newBookmarked
      });
    } catch (err) {
      console.error('Failed to update bookmark state:', err);
    }
  };

  const toggleShuffle = () => {
    if (isShuffled) {
      setQuestions([...originalQuestions]);
      setIsShuffled(false);
    } else {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setIsShuffled(true);
    }
    setCurrentIndex(0);
  };

  // Return to Configuration Screen
  const resetQuiz = () => {
    setQuizStarted(false);
    setQuizCompleted(false);
    setTimeTaken(0);
    setCurrentIndex(0);
    setQuestions([...originalQuestions]);
  };

  // Load recommendations click shortcut
  const handleRecommendationClick = (rec) => {
    if (rec.type === 'continue') {
      const firstUnattempted = originalQuestions.findIndex(q => !q.attempted);
      const startIndex = firstUnattempted > -1 ? firstUnattempted : 0;
      setQuestions([...originalQuestions]);
      setCurrentIndex(startIndex);
      setQuizMode(quizMetadata?.adaptiveDifficulty ? 'adaptive_practice' : 'practice');
      setQuizStarted(true);
      setTimerActive(true);
      return;
    }

    if (rec.type === 'weak_topics') {
      setQuizType('Weak Topics Quiz');
      setQuestionCount('Auto');
      setDifficulty('Mixed');
      setSelectedTopic('Entire Resource');
      return;
    }

    if (rec.type === 'revision') {
      setQuizType('Revision Quiz');
      setQuestionCount('Auto');
      setDifficulty('Mixed');
      return;
    }

    if (rec.type === 'quick') {
      setQuizType('Mixed');
      setQuestionCount('10');
      setDifficulty('Mixed');
      setSelectedTopic('Entire Resource');
      return;
    }

    if (rec.type === 'challenge') {
      setQuizType('Mixed');
      setQuestionCount('Auto');
      setDifficulty('Hard');
      setSelectedTopic('Entire Resource');
      return;
    }

    if (rec.type === 'adaptive') {
      setQuizType('Adaptive Quiz');
      setAttemptMode('adaptive_practice');
      setDifficulty('Mixed');
      return;
    }
  };

  // Display Loader
  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#66b8ff',
        gap: '12px'
      }}>
        <RefreshCw size={28} className="animate-spin" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Assembling Quiz via AI...</span>
      </div>
    );
  }

  // Display Error
  if (error) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#ff6666',
        textAlign: 'center',
        gap: '12px'
      }}>
        <AlertCircle size={28} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{error}</span>
        <button 
          onClick={() => handleGenerate(false)}
          disabled={loading}
          style={{
            marginTop: '12px',
            backgroundColor: loading ? 'rgba(255, 102, 102, 0.05)' : 'rgba(255, 102, 102, 0.1)',
            border: loading ? '1px solid rgba(255, 102, 102, 0.15)' : '1px solid rgba(255, 102, 102, 0.3)',
            color: loading ? 'rgba(255, 102, 102, 0.5)' : '#ff6666',
            padding: '6px 16px',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          {loading ? 'Retrying...' : 'Retry Quiz Generation'}
        </button>
      </div>
    );
  }

  // A. Redesigned Premium Configuration Dashboard Screen
  if (!quizStarted && !quizCompleted) {
    const hasAnalytics = quizMetadata && quizMetadata.attemptCount > 0;
    const hasBookmarks = originalQuestions.some(q => q.bookmarked);

    return (
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        backgroundColor: 'transparent'
      }}>
        {/* SECTION 1: AI RECOMMENDATIONS PANEL */}
        {hasAnalytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              ⭐ Recommended For You
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              {/* Rec 1: Adaptive Quiz */}
              <div 
                onClick={() => handleRecommendationClick({ type: 'adaptive' })}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(102, 184, 255, 0.08) 0%, rgba(102, 184, 255, 0.02) 100%)',
                  border: '1px solid rgba(102, 184, 255, 0.15)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.15)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#66b8ff' }}>
                  <TrendingUp size={11} />
                  <span>Adaptive Quiz</span>
                </div>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  Estimated Time: 12 minutes. Adjusts according to past scores.
                </div>
              </div>

              {/* Rec 2: Continue Last Quiz */}
              {quizMetadata.lastAttempt && (
                <div 
                  onClick={() => handleRecommendationClick({ type: 'continue' })}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                    <Play size={11} />
                    <span>Continue Last Quiz</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Resume quiz at first incomplete question.
                  </div>
                </div>
              )}

              {/* Rec 3: Practice Weak Topics */}
              {quizMetadata.analytics?.weakTopics?.length > 0 && (
                <div 
                  onClick={() => handleRecommendationClick({ type: 'weak_topics' })}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.08) 0%, rgba(248, 113, 113, 0.02) 100%)',
                    border: '1px solid rgba(248, 113, 113, 0.15)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.15)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#f87171' }}>
                    <Sliders size={11} />
                    <span>Practice Weak Topics</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Auto-generated from identified weak topics in your history.
                  </div>
                </div>
              )}

              {/* Rec 4: Revision Quiz */}
              {hasBookmarks && (
                <div 
                  onClick={() => handleRecommendationClick({ type: 'revision' })}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(251, 191, 36, 0.05)',
                    border: '1px solid rgba(251, 191, 36, 0.15)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, border-color 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.15)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>
                    <Bookmark size={11} />
                    <span>Revision Quiz</span>
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Generate quiz from bookmarked or incorrect questions.
                  </div>
                </div>
              )}

              {/* Rec 5: Quick Revision */}
              <div 
                onClick={() => handleRecommendationClick({ type: 'quick' })}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                  <Award size={11} />
                  <span>Quick Revision</span>
                </div>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  10 AI-selected crucial questions.
                </div>
              </div>

              {/* Rec 6: Challenge Me */}
              <div 
                onClick={() => handleRecommendationClick({ type: 'challenge' })}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#f87171' }}>
                  <AlertCircle size={11} />
                  <span>Challenge Me</span>
                </div>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  Hard questions focus only.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: LEARNING GOAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              🎯 Learning Goal
            </h4>
            <div style={{ fontSize: '0.675rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              What do you want to achieve today?
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'Understand Concepts', title: '📖 Understand Concepts', desc: 'Learn concepts slowly with detailed explanations.' },
              { id: 'Prepare for Exam', title: '🧠 Prepare for Exam', desc: 'Balanced university-style assessment.' },
              { id: 'Quick Revision', title: '⚡ Quick Revision', desc: 'Revise important concepts quickly.' },
              { id: 'Interview Preparation', title: '💼 Interview Preparation', desc: 'Generate conceptual technical interview questions.' },
              { id: 'Master This Topic', title: '🎯 Master This Topic', desc: 'Gradually increase difficulty until mastery.' }
            ].map(g => {
              const isSelected = learningGoal === g.id;
              return (
                <div 
                  key={g.id}
                  onClick={() => setLearningGoal(g.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(102, 184, 255, 0.08)' : 'rgba(255,255,255,0.01)',
                    border: isSelected ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#66b8ff' : '#ffffff' }}>
                      {g.title}
                    </span>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '1px solid ' + (isSelected ? '#66b8ff' : 'rgba(255,255,255,0.2)'),
                      backgroundColor: isSelected ? '#66b8ff' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSelected && <Check size={8} style={{ color: '#0f121a' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.675rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    {g.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: QUIZ TYPE SELECTION CARD GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Quiz Type
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'Mixed', title: 'Mixed Questions (Recommended)', desc: 'Balanced combination of Multiple Choice, True/False, and Open responses.' },
              { id: 'Multiple Choice', title: 'Multiple Choice (MCQ)', desc: 'Strictly multiple-choice questions with 4 unique options.' },
              { id: 'True / False', title: 'True / False', desc: 'Questions evaluating true or false statements.' },
              { id: 'Fill in the Blank', title: 'Fill in the Blank', desc: 'Pedagogical blanks to complete core keywords.' },
              { id: 'Short Answer', title: 'Short Answer', desc: 'Brief open responses checking conceptual explanations.' },
              { id: 'Adaptive Quiz', title: 'Adaptive Quiz', desc: 'AI continuously scales question difficulties according to your performance.' },
              { id: 'Weak Topics Quiz', title: 'Weak Topics Quiz', desc: 'Targeted focus on weak concepts found during previous attempts.' },
              { id: 'Revision Quiz', title: 'Revision Quiz', desc: 'Spaced repetition revision of bookmarked questions.' }
            ].map(t => {
              const isSelected = quizType === t.id;
              return (
                <div 
                  key={t.id}
                  onClick={() => setQuizType(t.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(102, 184, 255, 0.08)' : 'rgba(255,255,255,0.01)',
                    border: isSelected ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#66b8ff' : '#ffffff' }}>
                      {t.title}
                    </span>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '1px solid ' + (isSelected ? '#66b8ff' : 'rgba(255,255,255,0.2)'),
                      backgroundColor: isSelected ? '#66b8ff' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSelected && <Check size={8} style={{ color: '#0f121a' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.675rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    {t.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: DIFFICULTY CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Difficulty
          </h4>
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {['Mixed', 'Easy', 'Medium', 'Hard'].map(d => {
              const isSelected = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: isSelected ? '#66b8ff' : 'rgba(255,255,255,0.5)',
                    backgroundColor: isSelected ? 'rgba(102, 184, 255, 0.12)' : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: QUESTION COUNT SELECTOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Question Count
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {['10', '20', '30', 'Auto'].map(c => {
              const isSelected = questionCount === c;
              return (
                <button
                  key={c}
                  onClick={() => setQuestionCount(c)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid rgba(102, 184, 255, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                    background: isSelected ? 'rgba(102, 184, 255, 0.08)' : 'rgba(255,255,255,0.01)',
                    color: isSelected ? '#66b8ff' : 'rgba(255,255,255,0.7)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: DYNAMIC TOPIC SELECTION */}
        {availableTopics.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Topic Selection
            </h4>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: '#ffffff',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableTopics.map(t => (
                <option key={t} value={t} style={{ backgroundColor: '#0f121a', color: '#fff' }}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* SECTION 6: ATTEMPT MODE CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Attempt Mode
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'practice', title: 'Practice Mode', desc: 'Reveal answer feedback, and step-by-step explanations immediately after submission.' },
              { id: 'exam', title: 'Exam Mode', desc: 'Hide answers. Provide final scoring and weak topic outlines at completion.' },
              { id: 'adaptive_practice', title: 'Adaptive Practice', desc: 'AI modifies question difficulties dynamically based on your correctness.' }
            ].map(m => {
              const isSelected = attemptMode === m.id;
              return (
                <div 
                  key={m.id}
                  onClick={() => setAttemptMode(m.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(102, 184, 255, 0.08)' : 'rgba(255,255,255,0.01)',
                    border: isSelected ? '1px solid rgba(102, 184, 255, 0.35)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#66b8ff' : '#ffffff' }}>
                      {m.title}
                    </span>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '1px solid ' + (isSelected ? '#66b8ff' : 'rgba(255,255,255,0.2)'),
                      backgroundColor: isSelected ? '#66b8ff' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSelected && <Check size={8} style={{ color: '#0f121a' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.675rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    {m.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PREMIUM FEATURES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Premium Features
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Active Explain Mode Card */}
            <div 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('trigger-explain', {
                  detail: { concept: '', resourceId, source: 'quiz' }
                }));
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(102, 184, 255, 0.25)',
                backgroundColor: 'rgba(102, 184, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(102, 184, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(102, 184, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.25)';
              }}
            >
              <Sparkles size={12} style={{ color: '#66b8ff' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#66b8ff' }}>
                Explain Mode
              </span>
              <span style={{
                fontSize: '0.55rem',
                fontWeight: 700,
                color: '#66b8ff',
                backgroundColor: 'rgba(102, 184, 255, 0.15)',
                padding: '1px 4px',
                borderRadius: '3px',
                marginLeft: 'auto'
              }}>
                ACTIVE
              </span>
            </div>

            {/* Other Coming Soon Placeholders */}
            {[
              { label: 'Study Planner', icon: <Calendar size={12} /> },
              { label: 'Mind Maps', icon: <Map size={12} /> },
              { label: 'Deep Search', icon: <Layers2 size={12} /> }
            ].map((p, i) => (
              <div 
                key={i}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'not-allowed',
                  opacity: 0.4
                }}
              >
                {p.icon}
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  {p.label}
                </span>
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: '#fbbf24',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  marginLeft: 'auto'
                }}>
                  SOON
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 7: ✨ GENERATE QUIZ BUTTON */}
        <button
          onClick={() => handleGenerate(false)}
          disabled={loading}
          style={{
            backgroundColor: loading ? 'rgba(102, 184, 255, 0.3)' : '#66b8ff',
            color: loading ? 'rgba(255,255,255,0.4)' : '#0f121a',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px',
            transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 184, 255, 0.2)'
          }}
        >
          <Sparkles size={14} className={loading ? 'animate-pulse' : ''} />
          <span>{loading ? 'Generating Quiz...' : '✨ Generate Quiz'}</span>
        </button>
      </div>
    );
  }

  // B. Results Screen View
  if (quizCompleted && attemptAnalytics) {
    return (
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {/* Performance Header Card */}
        <div style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100px',
            height: '4px',
            backgroundColor: attemptAnalytics.percentage >= 80 ? '#34d399' : attemptAnalytics.percentage >= 60 ? '#66b8ff' : '#f87171'
          }}></div>
          <Award size={36} style={{ 
            color: attemptAnalytics.percentage >= 80 ? '#34d399' : attemptAnalytics.percentage >= 60 ? '#66b8ff' : '#f87171',
            margin: '0 auto 8px auto'
          }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>
            {attemptAnalytics.performanceSummary}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 12px 0' }}>
            Score: {attemptAnalytics.score} points • Time Taken: {formatTime(attemptAnalytics.timeTaken)}
          </p>

          <div style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: '#fff',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            lineHeight: 1
          }}>
            {attemptAnalytics.percentage}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginLeft: '2px' }}>%</span>
          </div>
        </div>

        {/* Correct/Incorrect Statistics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.1)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(52, 211, 153, 0.7)', fontWeight: 600, textTransform: 'uppercase' }}>Correct</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>{attemptAnalytics.correctCount}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.1)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(248, 113, 113, 0.7)', fontWeight: 600, textTransform: 'uppercase' }}>Incorrect</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>{attemptAnalytics.wrongCount}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>Skipped</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{attemptAnalytics.skippedCount}</div>
          </div>
        </div>

        {/* Weak Topics Box */}
        {attemptAnalytics.weakTopics.length > 0 ? (
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'rgba(248, 113, 113, 0.04)',
            border: '1px solid rgba(248, 113, 113, 0.1)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <TrendingUp size={13} style={{ color: '#f87171' }} />
              <h4 style={{ fontSize: '0.775rem', fontWeight: 700, color: '#f87171', margin: 0, textTransform: 'uppercase' }}>
                Weak Concepts Highlighted
              </h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {attemptAnalytics.weakTopics.map((topic, i) => (
                <span 
                  key={i} 
                  style={{
                    fontSize: '0.675rem',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    border: '1px solid rgba(248, 113, 113, 0.2)',
                    color: '#f87171',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '8px', lineHeight: '1.3' }}>
              AI has logged these weak topics. Future sessions in Weak Topic mode will focus purely on these themes.
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'rgba(52, 211, 153, 0.04)',
            border: '1px solid rgba(52, 211, 153, 0.1)',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#34d399',
            fontWeight: 600
          }}>
            🎉 Excellent mastery! No weak topics found.
          </div>
        )}

        {/* Collapsible Review list for Exam Mode */}
        <div style={{
          padding: '12px 14px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          marginTop: '8px'
        }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
            Review Questions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {questions.map((q, idx) => (
              <div key={q.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.775rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                  Q{idx + 1}: {q.question}
                </div>
                <div style={{ fontSize: '0.7rem', color: q.isCorrect ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{q.isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
                  <button
                    disabled={generatingExplain}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const concept = q.explanation || q.question;
                      if (!concept) return;
                      
                      const existing = explanationsList.find(
                        ex => ex.concept.toLowerCase() === concept.toLowerCase()
                      );
                      
                      if (existing) {
                        window.dispatchEvent(new CustomEvent('trigger-explain', {
                          detail: {
                            concept,
                            resourceId,
                            source: 'quiz',
                            explanationData: existing
                          }
                        }));
                      } else {
                        setGeneratingExplain(true);
                        try {
                          const res = await generateExplanation({
                            concept,
                            resourceId,
                            studySessionId,
                            difficulty: 'Medium'
                          });
                          if (res?.success && res.data) {
                            setExplanationsList(prev => [...prev, res.data]);
                            window.dispatchEvent(new CustomEvent('trigger-explain', {
                              detail: {
                                concept,
                                resourceId,
                                source: 'quiz',
                                explanationData: res.data
                              }
                            }));
                          }
                        } catch (err) {
                          console.error('Failed to generate explanation:', err);
                        } finally {
                          setGeneratingExplain(false);
                        }
                      }
                    }}
                    style={{
                      background: generatingExplain 
                        ? 'linear-gradient(135deg, rgba(102, 184, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)' 
                        : 'linear-gradient(135deg, rgba(102, 184, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                      border: '1px solid rgba(102, 184, 255, 0.35)',
                      borderRadius: '100px',
                      color: '#ffffff',
                      padding: '4px 10px',
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      cursor: generatingExplain ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                    onMouseOver={(e) => {
                      if (!generatingExplain) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 184, 255, 0.3)';
                        e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.6)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!generatingExplain) {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                        e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.35)';
                      }
                    }}
                  >
                    <Sparkles 
                      size={10} 
                      className={generatingExplain ? "spin-icon" : ""}
                      style={{ color: '#66b8ff' }} 
                    />
                    <span>{generatingExplain ? 'Generating...' : 'Explain'}</span>

                    {explanationsList.some(ex => ex.concept.toLowerCase() === (q.explanation || q.question || '').toLowerCase()) && (
                      <span style={{
                        fontSize: '0.55rem',
                        backgroundColor: 'rgba(52, 211, 153, 0.2)',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        color: '#34d399',
                        padding: '1px 4px',
                        borderRadius: '100px',
                        marginLeft: '4px',
                        fontWeight: 800
                      }}>
                        Cached
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Row */}
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
          <button
            onClick={resetQuiz}
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={13} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => handleGenerate(false)}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: loading ? 'rgba(102, 184, 255, 0.3)' : '#66b8ff',
              color: loading ? 'rgba(255,255,255,0.4)' : '#0f121a',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {loading ? (
              <span>Retaking...</span>
            ) : (
              <>
                <Play size={13} />
                <span>Retake Quiz</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // C. Active Quiz View
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      padding: '1.25rem',
      gap: '1rem',
      backgroundColor: 'transparent'
    }}>
      {/* Quiz Progress & Timer header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HelpCircle size={14} style={{ color: '#66b8ff' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            <Clock size={12} />
            <span>{formatTime(timeTaken)}</span>
          </div>

          <button
            onClick={handleBookmarkToggle}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: questions[currentIndex]?.bookmarked ? '#fbbf24' : 'rgba(255, 255, 255, 0.35)',
              transition: 'color 0.2s ease'
            }}
          >
            <Bookmark size={15} fill={questions[currentIndex]?.bookmarked ? '#fbbf24' : 'none'} />
          </button>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div style={{
        height: '4px',
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          backgroundColor: '#66b8ff',
          transition: 'width 0.3s ease'
        }}></div>
      </div>

      {/* Badges Row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: 
            questions[currentIndex]?.difficulty === 'Easy' ? 'rgba(52, 211, 153, 0.08)' :
            questions[currentIndex]?.difficulty === 'Hard' ? 'rgba(248, 113, 113, 0.08)' :
            'rgba(251, 191, 36, 0.08)',
          border: 
            questions[currentIndex]?.difficulty === 'Easy' ? '1px solid rgba(52, 211, 153, 0.25)' :
            questions[currentIndex]?.difficulty === 'Hard' ? '1px solid rgba(248, 113, 113, 0.25)' :
            '1px solid rgba(251, 191, 36, 0.25)',
          color: 
            questions[currentIndex]?.difficulty === 'Easy' ? '#34d399' :
            questions[currentIndex]?.difficulty === 'Hard' ? '#f87171' :
            '#fbbf24'
        }}>
          {questions[currentIndex]?.difficulty}
        </span>

        <span style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.6)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '120px'
        }}>
          {questions[currentIndex]?.topic}
        </span>

        <span style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.35)',
          marginLeft: 'auto'
        }}>
          {questions[currentIndex]?.points || 10} pts
        </span>
      </div>

      {/* Question Text */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingRight: '4px'
      }}>
        <p style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#ffffff',
          lineHeight: '1.5',
          margin: '0 0 4px 0'
        }}>
          {questions[currentIndex]?.question}
        </p>

        {/* Question Options / Inputs based on Question Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* MCQ or True/False Option Lists */}
          {(questions[currentIndex]?.type === 'Multiple Choice' || questions[currentIndex]?.type === 'True / False') && 
            questions[currentIndex].options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isSubmitted = questions[currentIndex].attempted;
              const isCorrectOpt = option.toLowerCase() === questions[currentIndex].correctAnswer.toLowerCase();

              let borderStyle = '1px solid rgba(255, 255, 255, 0.05)';
              let backgroundStyle = 'rgba(255, 255, 255, 0.01)';
              let colorStyle = 'rgba(255,255,255,0.7)';

              if (isSubmitted) {
                if (isCorrectOpt) {
                  borderStyle = '1px solid rgba(52, 211, 153, 0.3)';
                  backgroundStyle = 'rgba(52, 211, 153, 0.08)';
                  colorStyle = '#34d399';
                } else if (isSelected) {
                  borderStyle = '1px solid rgba(248, 113, 113, 0.3)';
                  backgroundStyle = 'rgba(248, 113, 113, 0.08)';
                  colorStyle = '#f87171';
                }
              } else if (isSelected) {
                borderStyle = '1px solid rgba(102, 184, 255, 0.3)';
                backgroundStyle = 'rgba(102, 184, 255, 0.08)';
                colorStyle = '#66b8ff';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={isSubmitted && quizMode === 'practice'}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: borderStyle,
                    background: backgroundStyle,
                    color: colorStyle,
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: (isSubmitted && quizMode === 'practice') ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <span>{option}</span>
                  {isSubmitted && isCorrectOpt && <Check size={14} style={{ color: '#34d399' }} />}
                  {isSubmitted && isSelected && !isCorrectOpt && <X size={14} style={{ color: '#f87171' }} />}
                </button>
              );
            })
          }

          {/* Fill in the Blank Text input */}
          {questions[currentIndex]?.type === 'Fill in the Blank' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                value={selectedAnswer}
                onChange={(e) => handleSelectOption(e.target.value)}
                disabled={questions[currentIndex].attempted && quizMode === 'practice'}
                placeholder="Type the missing word or phrase..."
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: questions[currentIndex].attempted ? 
                    (questions[currentIndex].isCorrect ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)') : 
                    '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
              {questions[currentIndex].attempted && quizMode === 'practice' && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: questions[currentIndex].isCorrect ? '#34d399' : '#f87171',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {questions[currentIndex].isCorrect ? 'Correct!' : `Incorrect. Answer is: ${questions[currentIndex].correctAnswer}`}
                </div>
              )}
            </div>
          )}

          {/* Short Answer Textarea input */}
          {questions[currentIndex]?.type === 'Short Answer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea
                value={selectedAnswer}
                onChange={(e) => handleSelectOption(e.target.value)}
                disabled={questions[currentIndex].attempted && quizMode === 'practice'}
                placeholder="Type your explanation or response..."
                rows={3}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: questions[currentIndex].attempted ? 
                    (questions[currentIndex].isCorrect ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)') : 
                    '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  resize: 'none',
                  width: '100%'
                }}
              />
              {questions[currentIndex].attempted && quizMode === 'practice' && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#fbbf24',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  Reference Answer: {questions[currentIndex].correctAnswer}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Question Explanation display */}
        {showExplanation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {/* Correct/Incorrect & Explain Answer premium bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: questions[currentIndex]?.isCorrect ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
              border: questions[currentIndex]?.isCorrect ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(248, 113, 113, 0.25)'
            }}>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: questions[currentIndex]?.isCorrect ? '#4ade80' : '#f87171'
              }}>
                {questions[currentIndex]?.isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </span>

              <button
                disabled={isExplanationLoading}
                onClick={handleExplainAnswer}
                style={{
                  background: isExplanationLoading 
                    ? 'linear-gradient(135deg, rgba(102, 184, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)' 
                    : 'linear-gradient(135deg, rgba(102, 184, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  border: '1px solid rgba(102, 184, 255, 0.35)',
                  borderRadius: '100px',
                  color: '#ffffff',
                  padding: '8px 18px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: isExplanationLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(102, 184, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                }}
                onMouseOver={(e) => {
                  if (!isExplanationLoading) {
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 184, 255, 0.35)';
                    e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.6)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isExplanationLoading) {
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 184, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(102, 184, 255, 0.35)';
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                <Sparkles 
                  size={12} 
                  className={isExplanationLoading ? "spin-icon" : ""}
                  style={{ color: '#66b8ff' }} 
                />
                <span>{isExplanationLoading ? 'Generating...' : 'Explain Answer'}</span>

                {questions[currentIndex] && explanationsList.some(ex => ex.concept.toLowerCase() === (questions[currentIndex].explanation || questions[currentIndex].question || '').toLowerCase()) && (
                  <span style={{
                    fontSize: '0.6rem',
                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    color: '#34d399',
                    padding: '1px 6px',
                    borderRadius: '100px',
                    marginLeft: '4px',
                    fontWeight: 800
                  }}>
                    Cached
                  </span>
                )}
              </button>
            </div>

            {/* Loading state */}
            {isExplanationLoading && (
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <Sparkles size={14} className="spin-icon" style={{ color: '#66b8ff' }} />
                <span>Generating explanation...</span>
              </div>
            )}

            {/* Error state */}
            {explanationError && !isExplanationLoading && (
              <div style={{
                padding: '14px',
                backgroundColor: 'rgba(248, 113, 113, 0.03)',
                border: '1px solid rgba(248, 113, 113, 0.15)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                  {explanationError}
                </span>
                <button
                  onClick={handleExplainAnswer}
                  style={{
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    border: '1px solid rgba(248, 113, 113, 0.25)',
                    color: '#f87171',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Success state */}
            {explanation && !isExplanationLoading && (
              <div style={{
                padding: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={12} style={{ color: '#66b8ff' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#66b8ff', textTransform: 'uppercase' }}>Explanation Details</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', lineHeight: '1.4' }}>
                  {explanation.simpleExplanation && (
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                        {explanation.simpleExplanation}
                      </p>
                    </div>
                  )}

                  {Array.isArray(explanation.howItWorks) && explanation.howItWorks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>How it works:</span>
                      {explanation.howItWorks.map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', color: 'rgba(255,255,255,0.7)' }}>
                          <span>•</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {explanation.example && (
                    <div style={{ borderLeft: '2px solid rgba(255,255,255,0.15)', paddingLeft: '8px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>
                      Example: {explanation.example}
                    </div>
                  )}

                  {explanation.remember && (
                    <div style={{ color: '#66b8ff', fontWeight: 500 }}>
                      Takeaway: {explanation.remember}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controller Buttons Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        {/* Navigation & Submit Action Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: currentIndex === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
              cursor: currentIndex === 0 ? 'default' : 'pointer'
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {!questions[currentIndex]?.attempted ? (
            <button
              onClick={submitAnswer}
              disabled={!selectedAnswer.trim()}
              style={{
                flex: 1,
                backgroundColor: selectedAnswer.trim() ? '#66b8ff' : 'rgba(255, 255, 255, 0.04)',
                border: 'none',
                color: selectedAnswer.trim() ? '#0f121a' : 'rgba(255,255,255,0.25)',
                fontWeight: 700,
                fontSize: '0.8rem',
                borderRadius: '6px',
                cursor: selectedAnswer.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={currentIndex < questions.length - 1 ? skipQuestion : completeQuiz}
              style={{
                flex: 1,
                backgroundColor: currentIndex < questions.length - 1 ? 'rgba(255, 255, 255, 0.04)' : '#34d399',
                border: currentIndex < questions.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                color: currentIndex < questions.length - 1 ? '#fff' : '#0f121a',
                fontWeight: 700,
                fontSize: '0.8rem',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
            </button>
          )}

          <button
            onClick={currentIndex < questions.length - 1 ? skipQuestion : completeQuiz}
            style={{
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Shuffle & Quit Action Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <button
            onClick={toggleShuffle}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: isShuffled ? '#66b8ff' : 'rgba(255, 255, 255, 0.35)',
              fontSize: '0.675rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Shuffle size={11} />
            <span>Shuffle Questions</span>
          </button>

          <button
            onClick={resetQuiz}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: 'rgba(248, 113, 113, 0.7)',
              fontSize: '0.675rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={11} />
            <span>Quit Quiz</span>
          </button>
        </div>
      </div>
    </div>
  );
});

QuizPanel.displayName = 'QuizPanel';
export default QuizPanel;
