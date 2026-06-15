const express = require('express');
const router = express.Router()

//importando controllers
const { buscarVagas } = require('../controllers/vagas/buscarVagas');
const { buscarVagasPorId } = require('../controllers/vagas/buscarVagasPorId');
const { criarVagas } = require('../controllers/vagas/criarVagas');
const { buscarVagasAdzuna } = require('../controllers/vagas/buscarVagasAdzuna');
const { buscarVagasJooble } = require('../controllers/vagas/buscarVagasJooble');

//rotas http
router.get('/', buscarVagas); //get /vagas
router.post('/', criarVagas); //post /vagas
router.get('/adzuna', buscarVagasAdzuna); //get /vaga/adzuna para buscar vagas da adzuna
router.get('/jooble', buscarVagasJooble); //get /vaga/jooble para buscar vagas da jooble
router.get('/:id', buscarVagasPorId); //get /vaga/1234567 (id da vaga)

//exportar rotas
module.exports = router;