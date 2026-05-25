//user/userController.js
const express = require('express');
const router = express.Router();
const UserModel = require('./userModel');

const dbFilePath = './db/logh.db'; // 데이터베이스 파일 경로

const userModel = new UserModel(dbFilePath);
//uuid로 회원 가입 여부 체크
router.post('/isRegisted', (req, res) => {
  const { uuid } = req.body;
  userModel.isRegisted(uuid, (err, user) => {
    if (err) {
      console.error('Error logging in:', err);
      res.status(500).json({ error: 'Failed to log in' });
    } else {
      const result = 'Y';
      res.status(200).json({ result, user });
    }
  });
});

router.post('/createUser', (req, res) => {
  const { uuid } = req.body;
  userModel.createUser(uuid, (err, user) => {
    if (err) {
      console.error('Error createUser:', err);
      res.status(500).json({ error: 'Failed to createUser' });
    } else {
      
    }
  });
});

router.post('/login', (req, res) => {
  const { userId, userPwd } = req.body;
  if (!userId || !userPwd) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }
  userModel.login(userId, userPwd, (err, user) => {
    if (err) {
      console.error('Error logging in:', err);
      return res.status(500).json({ error: 'Failed to log in' });
    }
    if (user) {
      res.status(200).json({ message: 'Login successful', user });
    } else {
      res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
  });
});

router.post('/register', (req, res) => {
  const { userId, userPwd, uuid } = req.body;
  if (!userId || !userPwd || !uuid) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }
  const checkQuery = `SELECT ID FROM TBL_USER_MAIN WHERE USER_ID = ?`;
  userModel.db.get(checkQuery, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB 오류' });
    if (row) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    userModel.register(userId, userPwd, uuid, (err, id) => {
      if (err) {
        console.error('Error registering:', err);
        return res.status(500).json({ error: '계정 생성에 실패했습니다.' });
      }
      userModel.login(userId, userPwd, (err, user) => {
        if (err || !user) return res.status(500).json({ error: '계정 생성 후 로그인 실패' });
        res.status(201).json({ message: 'Register successful', user });
      });
    });
  });
});

module.exports = router;
