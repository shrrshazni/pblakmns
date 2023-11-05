//jshint esversion:6
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const { render } = require('ejs');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');
const MongoDBSession = require('connect-mongodb-session')(session);
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fileUpload = require('express-fileupload');

const mongoURI = 'mongodb://localhost:27017/sessions';

const app = express();

app.use(fileUpload());
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// mongoose session option
const store = new MongoDBSession({
  uri: mongoURI,
  collections: 'mySessions',
  stringify: false,
  autoRemove: 'interval',
  autoRemoveInterval: 1
});

//init session
app.use(
  session({
    secret: 'Our little secret.',
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    store: store
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

//USER

//user init
const userSchema = new mongoose.Schema({
  fullname: String,
  password: String,
  username: String,
  email: String
});

//mongoose passport-local
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

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

//PAGES INITIALISATION

//HOME

app.get('/', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('home', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SIGN IN

app
  .get('/sign-in', function (req, res) {
    res.render('sign-in');
  })
  .post('/sign-in', async function (req, res) {
    const username = req.body.username;
    const password = req.body.password;

    const user = new User({
      username: username,
      password: password
    });

    req.login(user, function (err) {
      if (err) {
        console.log('Login error');
        res.redirect('/sign-in');
      } else {
        passport.authenticate('local')(req, res, function () {
          req.session.user = user;
          res.redirect('/');
        });
      }
    });
  });

//SIGN UP

app
  .get('/sign-up', function (req, res) {
    res.render('sign-up');
  })
  .post('/sign-up', function (req, res) {
    //pasport local mongoose
    User.register(
      {
        username: req.body.username,
        fullname: req.body.fullname,
        email: req.body.email
      },
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

//FORGOT PASSWORD

app.get('/forgot-password', function (req, res) {
  res.render('forgot-password');
});

//RESET PASSWORD

app.get('/reset-password', function (req, res) {
  res.render('reset-password');
});

// generate random id
const reportId = crypto.randomBytes(6).toString('hex').toUpperCase();

// For Files

// Define a schema for your model (e.g., for storing file metadata)
const FileSchema = new mongoose.Schema({
  reportId: String,
  filename: String,
  path: String
});

const File = mongoose.model('File', FileSchema);

app.post('/upload', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('There is no files selected');
  } else {
    // Check if the report ID exists in the database
    const existingFile = await File.findOne({ reportId: reportId });

    if (!existingFile) {
      // No file with the report ID found, proceed with file upload
      for (const file of Object.values(req.files)) {
        const uploadPath = __dirname + '/uploads/' + file.name;
        const uploadPath2 = 'uploads/' + file.name;

        file.mv(uploadPath, err => {
          if (err) {
            return res.status(500).send(err);
          }

          // Save file information to the MongoDB
          const newFile = new File({
            reportId: reportId,
            filename: file.name,
            path: uploadPath2
          });

          const result = newFile.save();
        });
      }
      console.log('Files uploaded');
    } else {
      // File with the report ID already exists
      console.log('Files already uploaded');
    }
  }
});

//PATROL REPORT SECTION

//patrol schema init
const patrolReportSchema = new mongoose.Schema({
  reportid: String,
  username: String,
  madeBy: String,
  type: String,
  start: String,
  end: String,
  date: String,
  summary: String,
  notes: String,
  location: String
});

const PatrolReport = mongoose.model('PatrolReport', patrolReportSchema);

//submit form
app
  .get('/patrol-report/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      const currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      if (checkUser) {
        res.render('patrol-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          reportId: reportId,
          //validation
          validationReportType: '',
          validationStartTime: '',
          validationEndTime: '',
          validationDate: '',
          validationLocation: '',
          validationReportSummary: '',
          validationNotes: '',
          //form name
          reportType: '',
          startTime: '',
          endTime: '',
          date: '',
          location: '',
          reportSummary: '',
          notes: '',
          //toast alert
          toastShow: '',
          toastMsg: ''
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/patrol-report/submit', async function (req, res) {
    var validationReportType = '';
    var validationStartTime = '';
    var validationEndTime = '';
    var validationDate = '';
    var validationLocation = '';
    var validationReportSummary = '';
    var validationNotes = '';

    const reportType = req.body.reportType;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    const location = req.body.location;
    const date = req.body.date;
    const reportSummary = req.body.reportSummary;
    const notes = req.body.notes;

    const currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the reportType
    if (!reportType || reportType === '') {
      validationReportType = 'is-invalid';
    } else {
      validationReportType = 'is-valid';
    }

    // Validate the startTime
    if (!startTime || startTime === '') {
      validationStartTime = 'is-invalid';
    } else {
      validationStartTime = 'is-valid';
    }

    // Validate the endTime
    if (!endTime || endTime === '') {
      validationEndTime = 'is-invalid';
    } else {
      validationEndTime = 'is-valid';
    }

    // Validate the date
    if (!date || date === '') {
      validationDate = 'is-invalid';
    } else {
      validationDate = 'is-valid';
    }

    // Validate the location
    if (!location || location === '') {
      validationLocation = 'is-invalid';
    } else {
      validationLocation = 'is-valid';
    }

    // Validate the reportSummary
    if (!reportSummary || reportSummary === '') {
      validationReportSummary = 'is-invalid';
    } else {
      validationReportSummary = 'is-valid';
    }

    // Validate the notes
    if (!notes || notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    if (
      validationReportType === 'is-valid' &&
      validationStartTime === 'is-valid' &&
      validationEndTime === 'is-valid' &&
      validationDate === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationReportSummary === 'is-valid' &&
      validationNotes === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const newReport = new PatrolReport({
        reportid: reportId,
        username: 'PB' + currentUser,
        madeBy: currentFullName,
        type: reportType,
        start: startTime,
        end: endTime,
        date: date,
        summary: reportSummary,
        notes: notes,
        location: location
      });

      const result = PatrolReport.create(newReport);

      if (result) {
        console.log('Successfully added report.');
        res.render('patrol-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          //validation
          validationReportType: '',
          validationDate: '',
          validationStartTime: '',
          validationEndTime: '',
          validationLocation: '',
          validationReportSummary: '',
          validationNotes: '',
          //form na
          reportType: '',
          startTime: '',
          endTime: '',
          date: '',
          location: '',
          reportSummary: '',
          notes: '',
          //toast alert
          toastShow: 'show',
          toastMsg: 'Succesfully submit a report'
        });
      } else {
        console.log('Report add failed');
        res.redirect('/patrol-report/submit');
      }
    } else {
      setTimeout(() => {
        // Render the response after the delay
        res.render('patrol-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          //validation
          validationReportType: validationReportType,
          validationDate: validationDate,
          validationStartTime: validationStartTime,
          validationEndTime: validationEndTime,
          validationLocation: validationLocation,
          validationReportSummary: validationReportSummary,
          validationNotes: validationNotes,
          //form na
          reportType: reportType,
          startTime: startTime,
          endTime: endTime,
          date: date,
          location: location,
          reportSummary: reportSummary,
          notes: notes,
          //toast alert
          toastShow: 'show',
          toastMsg: 'There is error in your input!'
        });
      }, 1000);
    }
  });

//details
app.get('/patrol-report/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('patrol-report-details', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

//view
app.get('/patrol-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('patrol-report-view', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

//CASE REPORT

// case schema init
const caseReportSchema = new mongoose.Schema({
  reportId: String,
  username: String,
  madeBy: String,
  type: String,
  time: String,
  date: String,
  location: String,
  summary: String,
  actionTaken: String,
  eventSummary: String,
  notes: String
});

const CaseReport = mongoose.model('CaseReport', caseReportSchema);

//submit form
app
  .get('/case-report/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      var currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      if (checkUser) {
        res.render('case-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/case-report/submit', async function (req, res) {
    const reportId = crypto.randomBytes(6).toString('hex').toUpperCase();
    const reportType = req.body.reportType;
    const eventSummary = req.body.eventSummary;
    const actionTaken = req.body.actionTaken;
    const location = req.body.location;
    const time = req.body.time;
    const date = req.body.date;
    const reportSummary = req.body.reportSummary;
    const notes = req.body.notes;

    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    const currentFullName = checkUser.fullname;
    const currentUser = checkUser.username;

    const newReport = new CaseReport({
      reportId: reportId,
      username: 'PB' + currentUser,
      madeBy: currentFullName,
      type: reportType,
      eventSummary: eventSummary,
      actionTaken: actionTaken,
      time: time,
      date: date,
      summary: reportSummary,
      notes: notes,
      location: location
    });

    const result = CaseReport.create(newReport);

    if (result) {
      console.log('Successfully added a report');
      res.redirect('/case-report/submit');
    } else {
      console.log('Report add failed');
      res.redirect('/case-report/submit');
    }
  });

//case-report-details
app.get('/case-report/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('case-report-details', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

//view
app.get('/case-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('case-report-view', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SCHEDULE

app.get('/schedule', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('schedule', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

//PROFILE

app.get('/social/profile', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('profile', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

//SETTINGS

app.get('/social/settings', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('settings', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SIGN OUT
app.get('/sign-out', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

//check server
app.listen(3000, function () {
  console.log('Server started on port 3000.');
});
