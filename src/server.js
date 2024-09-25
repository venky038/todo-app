const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();

app.use(express.json());

// Connect to SQLite database
const dbPath = path.resolve(__dirname, '../db/todo.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tasks table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Middleware for error handling
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
};

app.use(errorHandler);

// Add a root route
app.get('/', (req, res) => {
  res.send('Welcome to the Todo API! Use /tasks for managing tasks.');
});

// Validation middleware
const validateTask = [
  body('title').notEmpty().withMessage('Title is required').trim().escape(),
  body('description').optional().trim().escape(),
  body('completed').optional().isBoolean().withMessage('Completed must be a boolean')
];

// CRUD operations...

// Create a new task
app.post('/tasks', validateTask, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, completed } = req.body;
  db.run(
    `INSERT INTO tasks (title, description, completed) VALUES (?, ?, ?)`,
    [title, description, completed ? 1 : 0],
    function (err) {
      if (err) return next(err);
      res.status(201).json({ id: this.lastID, title, description, completed: !!completed });
    }
  );
});

// Get all tasks with optional filtering and pagination
app.get('/tasks', (req, res, next) => {
  const { completed, limit = 10, offset = 0 } = req.query;
  let sql = 'SELECT * FROM tasks';
  const params = [];

  if (completed !== undefined) {
    sql += ' WHERE completed = ?';
    params.push(completed === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(sql, params, (err, rows) => {
    if (err) return next(err);
    res.json({ tasks: rows, count: rows.length });
  });
});

// Get a task by ID
app.get('/tasks/:id', (req, res, next) => {
  const { id } = req.params;
  db.get(`SELECT * FROM tasks WHERE id = ?`, [id], (err, row) => {
    if (err) return next(err);
    if (!row) return res.status(404).json({ message: 'Task not found' });
    res.json({ task: row });
  });
});

// Update a task
app.put('/tasks/:id', validateTask, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { title, description, completed } = req.body;
  db.run(
    `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, description, completed ? 1 : 0, id],
    function (err) {
      if (err) return next(err);
      if (this.changes === 0) return res.status(404).json({ message: 'Task not found' });
      res.json({ message: 'Task updated', taskId: id });
    }
  );
});

// Delete a task
app.delete('/tasks/:id', (req, res, next) => {
  const { id } = req.params;
  db.run(`DELETE FROM tasks WHERE id = ?`, [id], function (err) {
    if (err) return next(err);
    if (this.changes === 0) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted', taskId: id });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});