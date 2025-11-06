// routes/conversations.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// Get all conversations for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [conversations] = await pool.execute(
      `SELECT c.*, 
              m.content as last_message,
              m.created_at as last_message_time,
              m.sender_id as last_message_sender_id,
              sender.username as last_message_sender_name,
              COUNT(DISTINCT cp.user_id) as participant_count
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON c.id = m.conversation_id
       LEFT JOIN users sender ON m.sender_id = sender.id
       WHERE cp.user_id = ? AND cp.is_active = TRUE
         AND m.id = (
           SELECT MAX(id) FROM messages 
           WHERE conversation_id = c.id
         )
       GROUP BY c.id
       ORDER BY c.last_message_at DESC`,
      [req.user.id]
    );

    // Get participants for each conversation
    for (let conv of conversations) {
      const [participants] = await pool.execute(
        `SELECT u.id, u.username, u.display_name, u.profile_picture_url, u.status, cp.role
         FROM conversation_participants cp
         INNER JOIN users u ON cp.user_id = u.id
         WHERE cp.conversation_id = ? AND cp.is_active = TRUE`,
        [conv.id]
      );
      conv.participants = participants;
    }

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Create new conversation (direct message or group)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { participant_ids, name, description, is_group = false } = req.body;

    if (!participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Participant IDs array required' 
      });
    }

    // For direct messages, check if conversation already exists
    if (!is_group && participant_ids.length === 1) {
      const [existingConvs] = await pool.execute(
        `SELECT c.id 
         FROM conversations c
         INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
         INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
         WHERE c.is_group = FALSE 
           AND cp1.user_id = ? AND cp2.user_id = ?`,
        [req.user.id, participant_ids[0]]
      );

      if (existingConvs.length > 0) {
        return res.json({
          success: true,
          message: 'Conversation already exists',
          data: { conversation_id: existingConvs[0].id }
        });
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create conversation
      const [convResult] = await connection.execute(
        'INSERT INTO conversations (name, description, is_group, created_by) VALUES (?, ?, ?, ?)',
        [name, description, is_group, req.user.id]
      );

      const conversationId = convResult.insertId;

      // Add participants (including current user)
      const allParticipants = [req.user.id, ...participant_ids];
      const participantValues = allParticipants.map(userId => 
        [conversationId, userId, userId === req.user.id ? 'admin' : 'member']
      );

      await connection.execute(
        'INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ?',
        [participantValues]
      );

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: 'Conversation created successfully',
        data: { conversation_id: conversationId }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get conversation details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [conversations] = await pool.execute(
      `SELECT c.*, 
              COUNT(DISTINCT cp.user_id) as participant_count
       FROM conversations c
       LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.is_active = TRUE
       WHERE c.id = ?
       GROUP BY c.id`,
      [req.params.id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    const conversation = conversations[0];

    // Get participants
    const [participants] = await pool.execute(
      `SELECT u.id, u.username, u.display_name, u.profile_picture_url, u.status, cp.role, cp.joined_at
       FROM conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = ? AND cp.is_active = TRUE`,
      [req.params.id]
    );

    conversation.participants = participants;

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;