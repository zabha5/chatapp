// routes/messages.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// Get messages for a conversation
router.get('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verify user is participant
    const [participants] = await pool.execute(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE',
      [conversationId, req.user.id]
    );

    if (participants.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to this conversation' 
      });
    }

    const [messages] = await pool.execute(
      `SELECT m.*, 
              u.username as sender_username,
              u.display_name as sender_display_name,
              u.profile_picture_url as sender_avatar,
              rm.content as reply_to_content,
              ru.username as reply_to_sender_username
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
       LEFT JOIN users ru ON rm.sender_id = ru.id
       WHERE m.conversation_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [conversationId, parseInt(limit), offset]
    );

    // Get read receipts for messages
    for (let message of messages) {
      const [receipts] = await pool.execute(
        `SELECT mr.user_id, u.username, mr.read_at 
         FROM message_read_receipts mr
         INNER JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id = ?`,
        [message.id]
      );
      message.read_receipts = receipts;
    }

    res.json({
      success: true,
      data: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Send a message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { conversation_id, content, message_type = 'text', reply_to_message_id } = req.body;

    if (!conversation_id || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Conversation ID and content are required' 
      });
    }

    // Verify user is participant
    const [participants] = await pool.execute(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE',
      [conversation_id, req.user.id]
    );

    if (participants.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to this conversation' 
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert message
      const [messageResult] = await connection.execute(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, reply_to_message_id) 
         VALUES (?, ?, ?, ?, ?)`,
        [conversation_id, req.user.id, content, message_type, reply_to_message_id || null]
      );

      // Update conversation last message time
      await connection.execute(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
        [conversation_id]
      );

      await connection.commit();
      connection.release();

      // Get the complete message with sender info
      const [messages] = await pool.execute(
        `SELECT m.*, 
                u.username as sender_username,
                u.display_name as sender_display_name,
                u.profile_picture_url as sender_avatar
         FROM messages m
         INNER JOIN users u ON m.sender_id = u.id
         WHERE m.id = ?`,
        [messageResult.insertId]
      );

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: messages[0]
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Mark message as read
router.post('/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Verify message exists and user has access
    const [messages] = await pool.execute(
      `SELECT m.conversation_id 
       FROM messages m
       INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
       WHERE m.id = ? AND cp.user_id = ?`,
      [messageId, req.user.id]
    );

    if (messages.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found or access denied' 
      });
    }

    // Insert or update read receipt
    await pool.execute(
      `INSERT INTO message_read_receipts (message_id, user_id) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
      [messageId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;