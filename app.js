//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const { render } = require('ejs');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

//init index
app.get('/', function (req, res) {
  res.render('sign-in');
});

//init forgot pasword
app.get('/forgot-password', function (req, res) {
  res.render('forgot-password');
});

//init reset password
app.get('/reset-password', function (req, res) {
  res.render('reset-password');
});

//init home
app.get('/home', function (req, res) {
  res.render('home');
});

//check server
app.listen(3000, function () {
  console.log('Server started on port 3000.');
});
