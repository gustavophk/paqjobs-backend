// arquivo main

//importando dependencias
require('dotenv').config();//carregar variaveis do .env
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

//importando routers
const vagaRouter = require('../src/routers/vaga.router');
const chabotRouter = require('../src/routers/chatbot.router');
const rotasGerais = require('./routers/index');


//inciando o express
const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.use(express.json()); //permite receber json no body
app.use(cors()); //permite que outros servidores/domínios acessem a API

//plugando as rotas no app
app.use('/', rotasGerais);

//montando a uri do banco mongo db
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOSTS}/${process.env.DB_NAME}?${process.env.DB_OPTIONS}`;

// Sobe o servidor primeiro
app.listen(port, host, () => {
  console.log(`Servidor rodando na porta: ${port}`);

  // Em seguida tenta conectar ao MongoDB (não bloqueia a inicialização HTTP)
  mongoose.connect(uri)
    .then(() => console.log("Conectado com sucesso ao MongoDB!"))
    .catch(error => console.error("Erro ao conectar ao banco:", error));
});