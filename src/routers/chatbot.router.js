const express = require('express');
const router = express.Router()
const chatbotController = require('../controllers/chatbot.controller');

//utilizando metodo post para a rota do chatbot
router.post('/converse', chatbotController.converse);
router.get('/converse', chatbotController.converse);

module.exports = router;