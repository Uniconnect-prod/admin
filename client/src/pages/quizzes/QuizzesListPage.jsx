import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Plus, Eye, Edit2, Copy, Globe, Trash2, Search, Filter } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import './Quizzes.scss';

export const QuizzesListPage = () => {
  const { activePlatform } = useAuth();

  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [difficulty, setDifficulty] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/quizzes', {
        params: { search, category, difficulty, status }
      });
      if (res.data?.success) {
        setQuizzes(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, difficulty, status, activePlatform?.code]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleTogglePublish = async (quiz) => {
    const nextStatus = quiz.status === 'Published' ? 'Draft' : 'Published';
    try {
      await api.put(`/quizzes/${quiz.id}`, { status: nextStatus });
      fetchQuizzes();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to permanently delete this quiz?')) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      fetchQuizzes();
    } catch (err) {
      alert('Failed to delete quiz.');
    }
  };

  const handleView = async (quiz) => {
    try {
      const res = await api.get(`/quizzes/${quiz.id}`);
      if (res.data?.success) {
        setSelectedQuiz(res.data.data);
        setViewModalOpen(true);
      }
    } catch (err) {
      alert('Failed to fetch quiz details.');
    }
  };

  const columns = [
    {
      header: 'Quiz ID',
      key: 'id',
      render: (row) => <span className="font-mono text-muted">#{row.id}</span>
    },
    {
      header: 'Quiz Name',
      key: 'title',
      render: (row) => (
        <div className="quiz-title-cell">
          <strong>{row.title}</strong>
          {activePlatform?.isAll && <span className="quiz-platform-sub">{row.platform_name}</span>}
        </div>
      )
    },
    {
      header: 'Category',
      key: 'category',
      render: (row) => <span className="category-pill">{row.category}</span>
    },
    {
      header: 'Questions',
      key: 'question_count',
      align: 'center',
      render: (row) => <span className="font-bold">{row.question_count} Qs</span>
    },
    {
      header: 'Difficulty',
      key: 'difficulty',
      render: (row) => (
        <span className={`diff-tag diff-${row.difficulty?.toLowerCase()}`}>
          {row.difficulty}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Published At',
      key: 'publish_date',
      render: (row) => (row.publish_date ? new Date(row.publish_date).toLocaleDateString() : '—')
    },
    {
      header: 'Created At',
      key: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString()
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (row) => (
        <div className="table-actions-group">
          <button type="button" className="btn-icon" onClick={() => handleView(row)} title="View Questions">
            <Eye size={15} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => handleTogglePublish(row)}
            title={row.status === 'Published' ? 'Unpublish' : 'Publish'}
          >
            <Globe size={15} className={row.status === 'Published' ? 'text-success' : 'text-muted'} />
          </button>
          <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(row.id)} title="Delete Quiz">
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="quizzes-page">
      <PageHeader
        title="Quizzes Management"
        subtitle={`Interactive trivia, test questions & reward content for ${activePlatform?.name || 'All Platforms'}`}
        breadcrumbs={['Home', 'Content Management', 'Quizzes']}
        platformBadge={activePlatform?.name}
        actions={
          <Link to="/quizzes/upload" className="btn btn-primary">
            <Plus size={15} />
            Upload New Quiz
          </Link>
        }
      />

      {/* Filter Row */}
      <div className="card quiz-filters-card">
        <div className="quiz-filter-row">
          <div className="filter-item search-item">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search by title or category..."
              className="form-control with-icon"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-item">
            <select className="form-control" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="ALL">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="filter-item">
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={quizzes}
        loading={loading}
        emptyMessage="No quizzes found matching your search."
      />

      {/* Quiz Detail Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={selectedQuiz?.title || 'Quiz Details'}
        maxWidth="680px"
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setViewModalOpen(false)}>
            Close
          </button>
        }
      >
        {selectedQuiz && (
          <div className="quiz-modal-content">
            <div className="quiz-modal-meta">
              <span className="category-pill">{selectedQuiz.category}</span>
              <span className={`diff-tag diff-${selectedQuiz.difficulty?.toLowerCase()}`}>{selectedQuiz.difficulty}</span>
              <StatusBadge status={selectedQuiz.status} />
            </div>

            <h4 className="questions-section-heading">Questions ({selectedQuiz.questions?.length || 0})</h4>
            <div className="modal-questions-list">
              {(selectedQuiz.questions || []).map((q, idx) => (
                <div key={q.id || idx} className="question-box">
                  <div className="q-title">
                    <strong>Q{idx + 1}.</strong> {q.question}
                  </div>
                  <div className="options-grid">
                    <div className={`opt-item ${q.correct_answer === 'A' ? 'correct' : ''}`}>
                      <span className="opt-key">A</span> {q.option_a}
                    </div>
                    <div className={`opt-item ${q.correct_answer === 'B' ? 'correct' : ''}`}>
                      <span className="opt-key">B</span> {q.option_b}
                    </div>
                    {q.option_c && (
                      <div className={`opt-item ${q.correct_answer === 'C' ? 'correct' : ''}`}>
                        <span className="opt-key">C</span> {q.option_c}
                      </div>
                    )}
                    {q.option_d && (
                      <div className={`opt-item ${q.correct_answer === 'D' ? 'correct' : ''}`}>
                        <span className="opt-key">D</span> {q.option_d}
                      </div>
                    )}
                  </div>
                  {q.explanation && (
                    <div className="q-explanation">
                      <em>Explanation: {q.explanation}</em>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

