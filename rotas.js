const express = require('express');
const jwt = require('jsonwebtoken'); // Para gerar o token JWT
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const { Usuario, Livro, Pedido, Avaliacao } = require('./esquema'); // Importa os modelos
const router = express.Router();
const { autenticar } = require('./middleware'); // Importa o middleware de autenticação


// Configuração do armazenamento de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads')); // Diretório para armazenar imagens
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Nome único para o arquivo
  }
});

// Middleware para upload de arquivos
const upload = multer({ storage });

// Rota para exibir a página de login
router.get('/login', (req, res) => {
    res.render('login'); // Renderiza a página de login
  });
  
// Página inicial
router.get('/formulario', (req, res) => {
  res.render('formulario');
});

router.get('/formulario-livro', (req, res) => {
  res.render('formulario-livro');
});

router.get('/formulario-avaliacao', async (req, res) => {
  const { livroId } = req.query;
  const livroObjectId = new mongoose.Types.ObjectId(livroId); // Converte a string para ObjectId
  
  try {
    const avaliacoes = await Avaliacao.find({ livroId: livroObjectId });
    res.render('formulario-avaliacao', { livroId, avaliacoes });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar avaliações.');
  }
});

// Configura o middleware de sessão
router.use(session({
  secret: 'seu-segredo-aqui',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }  // Para desenvolvimento, usado `false`. Para produção, deve ser `true` com HTTPS
}));

// Rota de login
router.post('/login', async (req, res) => {
  const { nome, senha } = req.body;
  try {
    const usuario = await Usuario.findOne({ nome });
    if (!usuario) {
      res.render('login', {
        messages: { error: 'Usuário não encontrado' }
      });      
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.render('login', { 
        messages: { error: 'Senha incorreta' }
      });
    }

    // Gerando o token JWT
    const token = jwt.sign(
      { id: usuario._id, nome: usuario.nome, role: usuario.role },
      'segredo',
      { expiresIn: '1h' }
    );

    // Armazenando o token no cookie
    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 3600000 }); // 1 hora

    // Armazenando o usuário completo na sessão
    req.session.usuario = usuario;

    // Buscar os livros do banco (usando Mongoose ou dados mockados)
    const livros = await Livro.find();  // Buscar livros no banco de dados

    // Defina o usuarioId na sessão
  req.session.usuarioId = usuario._id;
    // Redirecionar ou renderizar a página do catálogo com os dados necessários
    res.render('catalog', { livros, usuario: req.session.usuario });

  } catch (err) {
    console.error('Erro ao fazer login', err);
    res.render('login', {
      messages: { error: 'Erro no login' }
    });
  }
});

function verificarAdmin(req, res, next) {
  if (req.session.usuarioId) {
    Usuario.findById(req.session.usuarioId).then(usuario => {
      if (usuario.role !== 'admin') {
        return res.status(403).send('Acesso restrito para administradores.');
      }
      next();
    });
  } else {
    res.status(401).send('Usuário não autenticado');
  }
}

// Exemplo de uso da rota para administradores
router.get('/admin', verificarAdmin, (req, res) => {
  res.send('Bem-vindo à área de administração');
});

// Rota para o catálogo
router.get('/catalog', async (req, res) => {
  try {
    if (!req.session.usuario) {
      return res.redirect('/login'); // Se não estiver autenticado, redireciona para login
    }

    const livros = await Livro.find();

    // Renderiza a página de catálogo, passando os livros e o usuário
    res.render('catalog', { livros, usuario: req.session.usuario });
  } catch (err) {
    console.error('Erro ao acessar o catálogo', err);
    res.status(500).send('Erro ao acessar o catálogo');
  }
});

router.post('/salvar', async (req, res) => {
    try {
        const { nome, idade, email, senha, role } = req.body;

        // Verifica se o usuário já existe
        const usuarioExistente = await Usuario.findOne({ nome });
        if (usuarioExistente) {
            return res.status(400).send('Usuário já existe');
        }

        // Cria um novo usuário com os dados recebidos
        const novoUsuario = new Usuario({ nome, idade, email, senha, role: role || 'usuario' });

        await novoUsuario.save();  // Salva o novo usuário no banco de dados
        res.redirect('/login'); 
      } catch (err) {
        console.error('Erro ao salvar o usuário', err);
        res.status(500).send('Erro ao salvar usuário');
    }
});

//Adicionar livro
router.post('/adicionarLivro', upload.single('capa'), async (req, res) => {
  try {
    const { titulo, autor, ano, editora, preco } = req.body;
    const capa = req.file ? `/uploads/${req.file.filename}` : null; // Caminho da imagem

    const novoLivro = new Livro({ titulo, autor, ano, editora, preco, capa });
    await novoLivro.save();

    res.redirect('/catalog'); 
  } catch (err) {
    console.error('Erro ao adicionar livro:', err);
    res.status(500).send('Erro ao adicionar livro');
  }
});

// Rota para exibir detalhes de um livro específico
router.get('/livro/:id', async (req, res) => {
  try {
    if (!req.session.usuario) {
      return res.redirect('/login'); // Se não estiver autenticado, redireciona para login
    }
    const livroId = req.params.id;
    const page = parseInt(req.query.page) || 1; // Página atual, default é 1
    const limit = 3; // Número de avaliações por página
    const skip = (page - 1) * limit; // Pular as avaliações já exibidas nas páginas anteriores

    // Buscar o livro pelo ID
    const livro = await Livro.findById(livroId).exec();
    if (!livro) {
      return res.status(404).send('Livro não encontrado.');
    }

    // Buscar as avaliações associadas ao livro com paginação
    const avaliacoes = await Avaliacao.find({ livro: livroId })
      .skip(skip)
      .limit(limit)
      .exec();

    // Contar o total de avaliações para calcular o número de páginas
    const totalAvaliacoes = await Avaliacao.countDocuments({ livro: livroId }).exec();
    const totalPages = Math.ceil(totalAvaliacoes / limit); // Total de páginas

    // Renderizar a página do livro com as avaliações e informações de paginação
    res.render('livro', {
      livro: livro,
      avaliacoes: avaliacoes,
      totalPages: totalPages,
      currentPage: page,
      usuario: req.session.usuario
    });
  } catch (err) {
    console.error('Erro ao buscar livro:', err);
    res.status(500).send('Erro ao buscar livro.');
  }
});

// Rota para visualizar o perfil do usuário
router.get('/perfil', async (req, res) => {
  try {

    console.log('ID do usuário na sessão:', req.session.usuarioId);

    // Carregar o usuário logado diretamente usando req.session.usuarioId
    const usuario = await Usuario.findById(req.session.usuarioId); // Usando o usuarioId da sessão
    if (!usuario) {
      return res.status(404).send('Usuário não encontrado');
    }

    // Carregar os pedidos do usuário
    const pedidos = await Pedido.find({ usuario: usuario._id }); // Apenas busca pedidos associados ao usuário, sem populacao

    // Renderizar a página de perfil com os dados do usuário e pedidos
    res.render('perfil', {
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        dataCadastro: usuario.dataCadastro
      },
      pedidos
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar perfil');
  }
});

router.post('/criarPedido', async (req, res) => {
  try {
    console.log('ID do usuário na sessão:', req.session.usuarioId);  // Exibe o ID do usuário na sessão para depuração

    // Desestrutura os dados do corpo da requisição (endereço e carrinho)
    const { enderecoEntrega, carrinho } = req.body;

    // Verifica se o carrinho está vazio
    if (!carrinho || carrinho.length === 0) {
      return res.status(400).send('O carrinho está vazio.');
    }

    // Mapeia os itens do carrinho para um formato adequado para o pedido
    const itens = carrinho.map(item => ({
      produto: item.id,
      precoUnitario: item.preco,
      quantidade: 1,
      subtotal: item.preco
    }));

    // Calcula o custo total somando o subtotal de todos os itens
    const custoTotal = itens.reduce((total, item) => total + item.subtotal, 0);

    // Cria uma nova instância do modelo Pedido
    const novoPedido = new Pedido({
      usuario: req.session.usuarioId || null, 
      itens,
      enderecoEntrega,
      custoTotal
    });
  
    // Salva o novo pedido no banco de dados
    await novoPedido.save();
    res.status(200).send('Pedido criado com sucesso!');
  } catch (err) {
    console.error('Erro ao finalizar o pedido:', err);
    res.status(500).send('Erro ao finalizar o pedido.');
  }
});

router.post('/avaliacoes', async (req, res) => {
  try {
    const { livroId, nota, comentario } = req.body; // Desestrutura os dados da avaliação
    const livro = await Livro.findById(livroId); // Busca o livro pelo ID
    if (!livro) {
      return res.status(404).send('Livro não encontrado.'); // Retorna erro se o livro não for encontrado
    }

    // Criar nova avaliação
    const novaAvaliacao = new Avaliacao({ livro: livroId, nota, comentario });
    await novaAvaliacao.save(); // Salva a avaliação no banco de dados

    res.redirect(`/livro/${livroId}`); // Redireciona para a página do livro com avaliações
  } catch (err) {
    console.error('Erro ao adicionar avaliação:', err);
    res.status(500).send('Erro ao adicionar avaliação.');
  }
});

// Buscar avaliações por livro
router.get('/avaliacoes/:livroId', async (req, res) => {
  try {
    const { livroId } = req.params;
    const avaliacoes = await Avaliacao.find({ livro: livroId })  // Busca as avaliações para o livro
      .populate('usuario', 'nome')
      .sort({ data: -1 });

    res.json(avaliacoes);  // Retorna as avaliações em formato JSON
  } catch (err) {
    console.error('Erro ao buscar avaliações:', err);
    res.status(500).send('Erro ao buscar avaliações.');
  }
});
// Rota para exibir os livros no catálogo
router.get('/catalog', async (req, res) => {
    try {
      // Busca todos os livros no banco de dados
      const livros = await Livro.find({});
      // Passa os livros para a view 'catalog.ejs'
      res.render('catalog', { livros });
    } catch (err) {
      console.error('Erro ao buscar livros:', err);
      res.status(500).send('Erro ao buscar livros');
    }
  });

  // Rota para buscar os pedidos do usuário autenticado
router.get('/pedidos', async (req, res) => {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // Busca os pedidos do usuário logado
    const pedidos = await Pedido.find({ usuario: req.session.usuarioId })
      .populate('itens.produto', 'titulo preco')  // Popula os dados do livro (titulo e preço)
      .lean();  // Converte para objetos simples, sem os métodos do Mongoose

    res.json(pedidos);  // Retorna os pedidos em formato JSON
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao carregar pedidos' });
  }
});

module.exports = router;
