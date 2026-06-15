//Hub centralizador de rotas, onde importamos todas as rotas e definimos os prefixos para cada uma delas

const express = require('express');
const router = express.Router();

const chatbotRoutes = require('./chatbot.router');
const vagaRoutes = require('./vaga.router');
const pessoaRoutes = require('./pessoa.router');

//Definimos os prefixos das URLs
router.use('/chat', chatbotRoutes);
router.use('/vaga', vagaRoutes);
router.use('/user', pessoaRoutes);

module.exports = router;