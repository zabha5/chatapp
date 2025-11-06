// routes/users.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, email, display_name, profile_picture_url, status, last_seen, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { display_name, status } = req.body;
    
    await pool.execute(
      'UPDATE users SET display_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [display_name, status, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 2 characters' 
      });
    }

    const [users] = await pool.execute(
      `SELECT id, username, display_name, profile_picture_url, status, last_seen 
       FROM users 
       WHERE (username LIKE ? OR display_name LIKE ?) 
         AND id != ? 
         AND is_active = TRUE 
       LIMIT 20`,
      [`%${q}%`, `%${q}%`, req.user.id]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, display_name, profile_picture_url, status, last_seen, created_at 
       FROM users WHERE id = ? AND is_active = TRUE`,
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});
// Get all users (for contacts)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, email, display_name, profile_picture_url, status, last_seen 
       FROM users 
       WHERE id != ? AND is_active = TRUE
       ORDER BY display_name ASC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});
module.exports = router;