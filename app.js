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

//init session
app.use(
  session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false
  })
);

//init passport
app.use(passport.initialize());
app.use(passport.session());

//init mongoose
main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://localhost:27017/pblakmnsDB');
}

//init mongoose items

const userSchema = new mongoose.Schema({
  fullname: String,
  password: String,
  role: String,
  email: String
});

//mongoose passport-local
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//mongoose model
const User = new mongoose.model('User', userSchema);

//simplified passport-local-mongoose
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  const user = User.findById(id);
  if (!user) {
    done(null, false);
  } else {
    done(null, user);
  }
});

// SIGN IN

//init index
app.get('/', function (req, res) {
  res.render('sign-in');
});

app.post('/', async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  const user = new User({
    username: username,
    password: password
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/home');
      });
    }
  });
});

//SIGN UP

app.get('/sign-up', function (req, res) {
  res.render('sign-up');
});

app.post('/sign-up', function (req, res) {
  //pasport local mongoose
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect('/sign-up');
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/sign-in');
        });
      }
    }
  );
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

//PROFILE

app.get('/profile', function (req, res) {
  res.render('profile');
});

//SETTINGS

app.get('/settings', function (req, res) {
  res.render('settings');
});
//check server
app.listen(3000, function () {
  console.log('Server started on port 3000.');
});
