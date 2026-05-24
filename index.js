// index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8081;

app.use(cors());
app.use(bodyParser.json());

const userRoutes = require('./user/userController');
app.use('/user', userRoutes);

const db = new sqlite3.Database('db/logh.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// 서버 종료 시 데이터베이스 연결 종료
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Closed the SQLite database connection.');
    process.exit(0);
  });
});

app.post('/', (req, res) => {
  console.info('1231231312313123123123')
  res.status(200).json({ result : '200' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
