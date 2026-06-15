const express = require('express');
const router = express.Router();
const getPessoas = require('../controllers/pessoas/getPessoas');
const getPessoaPorId = require('../controllers/pessoas/getPessoaPorId');
const criarPessoa = require('../controllers/pessoas/criarPessoa');
const atualizarPessoa = require('../controllers/pessoas/atualizarPessoa');
const deletarPessoa = require('../controllers/pessoas/deletarPessoa');

router.get('/', getPessoas);
router.get('/:id', getPessoaPorId);
router.post('/', criarPessoa);
router.put('/:id', atualizarPessoa);
router.delete('/:id', deletarPessoa);

module.exports = router;
