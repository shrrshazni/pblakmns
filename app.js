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

// STARTUP

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

//PATROL REPORT SECTION

//submit form
app.get('/patrol-report/submit', function (req, res) {
  res.render('patrol-report-submit');
});

//details
app.get('/patrol-report/details', function (req, res) {
  res.render('patrol-report-details');
});

//view
app.get('/patrol-report/view', function (req, res) {
  res.render('patrol-report-submit');
});

//CASE REPORT

//submit form
app.get('/case-report/submit', function (req, res) {
  res.render('case-report-submit');
});

//case-report-details
app.get('/case-report/details', function (req, res) {
  res.render('case-report-details');
});

// SCHEDULE

app.get('/schedule', function (req, res) {
  res.render('schedule');
});

//check server
app.listen(3000, function () {
  console.log('Server started on port 3000.');
});
