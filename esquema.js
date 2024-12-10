const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');  // Certifique-se de usar o 'bcryptjs'

const UsuarioSchema = new mongoose.Schema({
    nome: {
      type: String,
      required: true,
      unique: true
    },
    idade: {
      type: Number,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    senha: {
      type: String,
      required: true
    },
    role: { type: String, enum: ['admin', 'usuario'], default: 'usuario' },  // Adicionando o campo role
})

// Esquema para o Livro
const LivroSchema = new mongoose.Schema({
    titulo: {
      type: String,
      required: true
    },
    autor: {
        type: String,
        required: true
    },
    ano: {
        type: Number,
        required: true
    }, 
    editora: {
        type: String,
        required: true
    },
    preco: { 
      type: Number, 
      required: true 
    },
    capa: {
      type: String,
      required: true
    },
    
  });

  // Esquema para os Itens do Pedido
const ItemPedidoSchema = new mongoose.Schema({
  produto: {
    type: mongoose.Schema.Types.ObjectId, // Relaciona com o Livro
    ref: 'Livro',
    required: true
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1
  },
  precoUnitario: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  }
});

// Esquema para o Pedido
const PedidoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId, // Relaciona com o Usuário
    ref: 'Usuario',
    required: true
  },
  itens: [ItemPedidoSchema], // Array de itens do pedido
  custoTotal: {
    type: Number,
    required: true
  },
  dataPedido: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['pendente', 'processado', 'entregue', 'cancelado'],
    default: 'pendente'
  },
  enderecoEntrega: {
    type: String,
    required: true
  }
});

const AvaliacaoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: false },  // Torne o campo 'usuario' opcional
  livro: { type: mongoose.Schema.Types.ObjectId, ref: 'Livro', required: true },
  nota: { type: Number, required: true, min: 1, max: 5 }, // Nota de 1 a 5
  comentario: { type: String, required: true },
  data: { type: Date, default: Date.now }
});

// Middleware para hash da senha antes de salvar
UsuarioSchema.pre('save', async function(next) {
  if (this.isModified('senha') || this.isNew) {  // Verifica se a senha foi modificada ou se é um novo usuário
      try {
          // Gera o salt (valor aleatório) para o hash
          const salt = await bcrypt.genSalt(10);  // Usando 10 rounds para o salt
          // Cria o hash da senha usando o salt gerado
          const hash = await bcrypt.hash(this.senha, salt);
          this.senha = hash;  // Substitui a senha pela versão hasheada
          next();  // Chama o próximo middleware ou a operação de salvar
      } catch (err) {
          next(err);  // Caso ocorra algum erro, o erro é passado para o middleware
      }
  } else {
      next();  // Se a senha não for modificada, o processo continua normalmente
  }
});
// Método para comparar a senha no login
/*UsuarioSchema.methods.compararSenha = async function(senha) {
  return await bcrypt.compare(senha, this.senha); // Compara a senha inserida com a criptografada
};*/

const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Livro = mongoose.model('Livro', LivroSchema);
const Pedido = mongoose.model('Pedido', PedidoSchema);
const Avaliacao = mongoose.model('Avaliacao', AvaliacaoSchema);

module.exports = {Usuario, Livro, Pedido, Avaliacao};