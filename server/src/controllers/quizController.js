import { db } from '../models/db.js';
import { logAudit } from '../middleware/auditLogger.js';

export const quizController = {
  async getQuizzes(req, res) {
    try {
      const { category, difficulty, status, search } = req.query;
      const conditions = [];
      const params = [];

      if (!req.activePlatform.isAll) {
        conditions.push('q.platform_id = ?');
        params.push(req.activePlatform.id);
      }

      if (category && category !== 'ALL') {
        conditions.push('q.category = ?');
        params.push(category);
      }

      if (difficulty && difficulty !== 'ALL') {
        conditions.push('q.difficulty = ?');
        params.push(difficulty);
      }

      if (status && status !== 'ALL') {
        conditions.push('q.status = ?');
        params.push(status);
      }

      if (search && search.trim()) {
        conditions.push('(q.title LIKE ? OR q.category LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT q.*, p.name as platform_name, p.code as platform_code,
               (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count
        FROM quizzes q
        JOIN platforms p ON q.platform_id = p.id
        ${whereClause}
        ORDER BY q.created_at DESC
      `;

      const quizzes = await db.all(sql, params);

      return res.status(200).json({ success: true, data: quizzes });
    } catch (err) {
      console.error('[QuizController] getQuizzes error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve quizzes.' });
    }
  },

  async getQuizById(req, res) {
    try {
      const { id } = req.params;
      const quiz = await db.get(
        `SELECT q.*, p.name as platform_name, p.code as platform_code
         FROM quizzes q
         JOIN platforms p ON q.platform_id = p.id
         WHERE q.id = ?`,
        [id]
      );

      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found.' });
      }

      if (!req.activePlatform.isAll && quiz.platform_id !== req.activePlatform.id) {
        return res.status(403).json({ success: false, message: 'Access denied to quiz from another platform.' });
      }

      const questions = await db.all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY id ASC', [id]);

      return res.status(200).json({
        success: true,
        data: {
          ...quiz,
          questions
        }
      });
    } catch (err) {
      console.error('[QuizController] getQuizById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve quiz details.' });
    }
  },

  async createQuiz(req, res) {
    try {
      const {
        title,
        category,
        difficulty = 'Medium',
        status = 'Draft',
        publish_date,
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        questions
      } = req.body;

      if (!title || !category) {
        return res.status(400).json({ success: false, message: 'Quiz title and category are required.' });
      }

      const platformId = req.activePlatform.isAll ? 1 : req.activePlatform.id;

      const quizRes = await db.run(
        `INSERT INTO quizzes (platform_id, title, category, difficulty, status, publish_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [platformId, title.trim(), category.trim(), difficulty, status, publish_date || new Date().toISOString()]
      );

      const newQuizId = quizRes.lastID;

      // Insert question(s)
      if (Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          await db.run(
            `INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newQuizId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation || '']
          );
        }
      } else if (question && option_a && option_b && correct_answer) {
        await db.run(
          `INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newQuizId, question, option_a, option_b, option_c || '', option_d || '', correct_answer, explanation || '']
        );
      }

      await logAudit(req, 'CREATE_QUIZ', 'Quiz', newQuizId, { title, category, status });

      return res.status(201).json({
        success: true,
        message: 'Quiz created successfully.',
        data: { id: newQuizId, title, status }
      });
    } catch (err) {
      console.error('[QuizController] createQuiz error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create quiz.' });
    }
  },

  async updateQuiz(req, res) {
    try {
      const { id } = req.params;
      const { title, category, difficulty, status, publish_date } = req.body;

      const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [id]);
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found.' });
      }

      if (!req.activePlatform.isAll && quiz.platform_id !== req.activePlatform.id) {
        return res.status(403).json({ success: false, message: 'Forbidden. Quiz belongs to another platform.' });
      }

      await db.run(
        `UPDATE quizzes 
         SET title = COALESCE(?, title),
             category = COALESCE(?, category),
             difficulty = COALESCE(?, difficulty),
             status = COALESCE(?, status),
             publish_date = COALESCE(?, publish_date),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, category, difficulty, status, publish_date, id]
      );

      await logAudit(req, 'UPDATE_QUIZ', 'Quiz', id, { title, status });

      return res.status(200).json({ success: true, message: 'Quiz updated successfully.' });
    } catch (err) {
      console.error('[QuizController] updateQuiz error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update quiz.' });
    }
  },

  async deleteQuiz(req, res) {
    try {
      const { id } = req.params;
      const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [id]);
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found.' });
      }

      if (!req.activePlatform.isAll && quiz.platform_id !== req.activePlatform.id) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }

      await db.run('DELETE FROM quizzes WHERE id = ?', [id]);
      await logAudit(req, 'DELETE_QUIZ', 'Quiz', id);

      return res.status(200).json({ success: true, message: 'Quiz deleted successfully.' });
    } catch (err) {
      console.error('[QuizController] deleteQuiz error:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete quiz.' });
    }
  },

  // Bulk CSV/JSON Question Import
  async importQuestions(req, res) {
    try {
      const { quizId, items } = req.body;

      if (!quizId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload. quizId and non-empty items array required.'
        });
      }

      const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [quizId]);
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Target quiz not found.' });
      }

      // Existing questions for duplicate detection
      const existing = await db.all('SELECT question FROM quiz_questions WHERE quiz_id = ?', [quizId]);
      const existingSet = new Set(existing.map(q => q.question.toLowerCase().trim()));

      let importedCount = 0;
      let duplicateCount = 0;
      const errors = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.question || !item.option_a || !item.option_b || !item.correct_answer) {
          errors.push({ row: i + 1, message: 'Missing required question or options.' });
          continue;
        }

        const normalizedQuestion = item.question.toLowerCase().trim();
        if (existingSet.has(normalizedQuestion)) {
          duplicateCount++;
          continue;
        }

        await db.run(
          `INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            quizId,
            item.question.trim(),
            item.option_a.trim(),
            item.option_b.trim(),
            item.option_c?.trim() || '',
            item.option_d?.trim() || '',
            item.correct_answer.toUpperCase().trim(),
            item.explanation?.trim() || ''
          ]
        );

        existingSet.add(normalizedQuestion);
        importedCount++;
      }

      await logAudit(req, 'IMPORT_QUIZ_QUESTIONS', 'Quiz', quizId, { importedCount, duplicateCount, errorsCount: errors.length });

      return res.status(200).json({
        success: true,
        message: `Import completed. ${importedCount} added, ${duplicateCount} duplicates skipped, ${errors.length} errors.`,
        summary: {
          totalProcessed: items.length,
          imported: importedCount,
          duplicates: duplicateCount,
          errors
        }
      });
    } catch (err) {
      console.error('[QuizController] importQuestions error:', err);
      return res.status(500).json({ success: false, message: 'Failed to import quiz questions.' });
    }
  }
};

