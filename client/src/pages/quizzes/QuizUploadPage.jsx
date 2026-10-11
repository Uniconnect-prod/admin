import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle2, AlertCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import './Quizzes.scss';

export const QuizUploadPage = () => {
  const { activePlatform } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Single Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'General Knowledge',
    difficulty: 'Medium',
    status: 'Draft',
    publish_date: new Date().toISOString().slice(0, 10),
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    explanation: ''
  });

  // Bulk Upload State
  const [targetQuizId, setTargetQuizId] = useState('1');
  const [rawCsvText, setRawCsvText] = useState(
    `question,option_a,option_b,option_c,option_d,correct_answer,explanation
"Which Ghanaian artist won Best African Music Act in 2025?","Stonebwoy","Black Sherif","Sarkodie","King Promise","B","Black Sherif won with his critically acclaimed album."
"What is the currency code of Ghana?","GHD","GHC","GHS","CED","C","The official ISO 4217 code is GHS, commonly denoted as GHC locally."
"Which national park in Ghana is famous for canopy walkways?","Mole National Park","Kakum National Park","Ankasa Reserve","Bia National Park","B","Kakum National Park features the iconic rainforest canopy walkway."`
  );
  const [importSummary, setImportSummary] = useState(null);

  const handleSingleSubmit = async (statusOverride) => {
    if (!formData.title || !formData.question || !formData.option_a || !formData.option_b) {
      alert('Please fill in Quiz Name, Question, Option A, and Option B.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        status: statusOverride || formData.status
      };

      const res = await api.post('/quizzes', payload);
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Quiz created and published successfully!' });
        setTimeout(() => navigate('/quizzes'), 1200);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to save quiz.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!rawCsvText.trim()) {
      alert('Please paste or upload CSV questions text.');
      return;
    }

    try {
      setLoading(true);
      setImportSummary(null);

      // Parse CSV rows simple and robustly
      const lines = rawCsvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        alert('CSV must have a header line and at least one question line.');
        return;
      }

      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV fields handling quotes
        const match = line.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g);
        if (match && match.length >= 5) {
          const clean = match.map(m => m.replace(/^,/, '').replace(/^"/, '').replace(/"$/, '').trim());
          items.push({
            question: clean[0],
            option_a: clean[1],
            option_b: clean[2],
            option_c: clean[3] || '',
            option_d: clean[4] || '',
            correct_answer: (clean[5] || 'A').toUpperCase(),
            explanation: clean[6] || ''
          });
        }
      }

      const res = await api.post('/quizzes/import', {
        quizId: targetQuizId,
        items
      });

      if (res.data?.success) {
        setImportSummary(res.data.summary);
        setFeedback({ type: 'success', message: res.data.message });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Import failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quiz-upload-page">
      <PageHeader
        title="Upload & Content Administration"
        subtitle={`Create individual questions or batch import trivia for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'Content Management', 'Quiz Upload']}
        platformBadge={activePlatform?.name}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/quizzes')}>
            <ArrowLeft size={14} />
            Back to Quizzes
          </button>
        }
      />

      {feedback && (
        <div className={`feedback-alert alert-${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Mode Switcher Pills */}
      <div className="upload-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
          onClick={() => setMode('single')}
        >
          <FileText size={16} />
          Single Quiz Creator
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'bulk' ? 'active' : ''}`}
          onClick={() => setMode('bulk')}
        >
          <Upload size={16} />
          CSV Bulk Question Import
        </button>
      </div>

      {mode === 'single' ? (
        <div className="single-upload-form card">
          <h3 className="section-title">Quiz Details & Question Form</h3>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Quiz Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. African Cinema Trivia Master"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                className="form-control"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="General Knowledge">General Knowledge</option>
                <option value="Movies & TV">Movies & TV</option>
                <option value="Sports">Sports</option>
                <option value="Afrobeats & Music">Afrobeats & Music</option>
                <option value="History & Geography">History & Geography</option>
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label>Difficulty</label>
              <select
                className="form-control"
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>

            <div className="form-group">
              <label>Publish Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.publish_date}
                onChange={(e) => setFormData({ ...formData, publish_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-divider" />

          <h4 className="question-heading">Primary Question Details</h4>

          <div className="form-group">
            <label>Question Prompt</label>
            <textarea
              rows={3}
              className="form-control"
              placeholder="Enter the trivia question..."
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Option A</label>
              <input
                type="text"
                className="form-control"
                placeholder="Option A"
                value={formData.option_a}
                onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Option B</label>
              <input
                type="text"
                className="form-control"
                placeholder="Option B"
                value={formData.option_b}
                onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Option C (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Option C"
                value={formData.option_c}
                onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Option D (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Option D"
                value={formData.option_d}
                onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Correct Answer</label>
              <select
                className="form-control"
                value={formData.correct_answer}
                onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>
            <div className="form-group">
              <label>Explanation (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Why is this answer correct?"
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions-bottom">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/quizzes')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSingleSubmit('Draft')}
              disabled={loading}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSingleSubmit('Published')}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Publish Quiz'}
            </button>
          </div>
        </div>
      ) : (
        /* Bulk CSV Upload Form */
        <div className="bulk-upload-section card">
          <h3 className="section-title">Bulk CSV Import Engine</h3>
          <p className="section-sub">
            Paste or load CSV rows formatted with columns: <code>question,option_a,option_b,option_c,option_d,correct_answer,explanation</code>
          </p>

          <div className="form-group">
            <label>Target Quiz ID to Append To</label>
            <input
              type="number"
              className="form-control"
              style={{ maxWidth: '200px' }}
              value={targetQuizId}
              onChange={(e) => setTargetQuizId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>CSV Content (Sample Pre-Loaded)</label>
            <textarea
              rows={8}
              className="form-control font-mono"
              value={rawCsvText}
              onChange={(e) => setRawCsvText(e.target.value)}
            />
          </div>

          <div className="bulk-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBulkImport}
              disabled={loading}
            >
              <Upload size={15} />
              {loading ? 'Importing & Validating...' : 'Validate & Import Questions'}
            </button>
          </div>

          {importSummary && (
            <div className="import-summary-card">
              <h4>Import Execution Report:</h4>
              <div className="summary-stats-row">
                <div className="stat-pill success">
                  <strong>{importSummary.imported}</strong> Questions Added
                </div>
                <div className="stat-pill warning">
                  <strong>{importSummary.duplicates}</strong> Duplicates Skipped
                </div>
                <div className="stat-pill error">
                  <strong>{importSummary.errors?.length || 0}</strong> Errors
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

