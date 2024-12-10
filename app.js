const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const createError = require('http-errors');
require('dotenv').config();

const app = express();
const porta = process.env.PORT || 3001;


const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());

// Importa rotas
const rotas = require('./rotas');

// Sessão e flash messages
app.use(session({
  secret: 'segredo',  // Utilize uma chave secreta
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');

// Configurações de middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(bodyParser.json());

const router = require('./rotas');

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Conexão ao MongoDB
mongoose.connect('mongodb://localhost:27017/PampaDB')
  .then(() => console.log('Conectado ao MongoDB com sucesso'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Conecta rotas
app.use('/', rotas);

// Configuração de erros
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// Inicia o servidor
app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP
});

app.use(limiter);

const xss = require('xss-clean');
app.use(xss());

module.exports = app;
