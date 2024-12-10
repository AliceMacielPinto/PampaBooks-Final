const jwt = require('jsonwebtoken');

const autenticar = (req, res, next) => {
  const token = req.cookies.token; // Ou o método que você está usando para obter o token
  if (!token) {
    return res.redirect('/login'); // Redireciona para o login se o token não for encontrado
  }

  try {
    const decoded = jwt.verify(token, 'seuSegredo'); // Verifica o token JWT
    req.usuario = decoded; // Armazena os dados do usuário no request
    next(); // Chama a próxima função (neste caso, a rota /catalog)
  } catch (err) {
    return res.redirect('/login'); // Redireciona se o token não for válido
  }
};

module.exports = { autenticar };
