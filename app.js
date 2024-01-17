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
const moment = require('moment');
const path = require('path');
const fileUpload = require('express-fileupload');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
// getdate
const dateLocal = require('./public/assets/js/date');
const cool = require('cool-ascii-faces');
// judoscale
// const judoscale = require('judoscale-express').default;

const mongoURI =
  'mongodb+srv://shrrshazni:protechlakmns123@cluster0.rembern.mongodb.net/sessions';

const app = express();

app.use(fileUpload());
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
// app.use(judoscale());

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
    store: store
  })
);

//init passport
app.use(passport.initialize());
app.use(passport.session());

//init mongoose
main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(
    'mongodb+srv://shrrshazni:protechlakmns123@cluster0.rembern.mongodb.net/auxiliaryPolice'
  );
}

//USER

//user init
const userSchema = new mongoose.Schema({
  fullname: String,
  password: String,
  username: String,
  email: String,
  phone: String,
  profile: String,
  role: String
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

// Create a transporter using SMTP transport
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shrrshazni@gmail.com',
    pass: 'hzjlhfyspfyynndw'
  }
});

// INIT CURRENT TIME UTC+8

const getKualaLumpurTime = () => {
  const kualaLumpurTimeZoneOffset = 8; // Kuala Lumpur is UTC+8
  const now = moment().utcOffset(kualaLumpurTimeZoneOffset);
  return now.format('hh:mm A');
};

// HOME
app.get('/', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('home', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
        role: checkUser.role
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SIGN IN
app
  .get('/sign-in', function (req, res) {
    res.render('sign-in', {
      // validation
      validationUsername: '',
      validationPassword: '',
      // input value
      username: '',
      password: '',
      // toast
      toastShow: '',
      toastMsg: ''
    });
  })
  .post('/sign-in', async function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const rememberMe = req.body.rememberMe;

    // Set the session duration based on the 'rememberMe' checkbox
    const sessionDuration = rememberMe
      ? 7 * 24 * 60 * 60 * 1000
      : 1 * 60 * 60 * 1000;

    req.session.cookie.maxAge = sessionDuration;

    var validationUsername = '';
    var validationPassword = '';

    const passwordRegex = /^(?:\d+|[a-zA-Z0-9]{4,})/;

    const user = await User.findByUsername(username);
    var checkUser = '';

    if (!user) {
      checkUser = 'Not found';
    } else {
      checkUser = 'Found';
    }

    // validation username
    if (username === '' || checkUser === 'Not found') {
      validationUsername = 'is-invalid';
    } else {
      validationUsername = 'is-valid';
    }

    // validation username
    if (password === '' || passwordRegex.test(password) === 'false') {
      validationPassword = 'is-invalid';
    } else {
      validationPassword = 'is-valid';
    }

    if (
      validationUsername === 'is-valid' &&
      validationPassword === 'is-valid'
    ) {
      const user = new User({
        username: username,
        password: password
      });

      req.login(user, function (err) {
        console.log(err);
        if (err) {
          console.log('Login error');
          validationPassword = 'is-invalid';
          res.render('sign-in', {
            // validation
            validationUsername: validationUsername,
            validationPassword: validationPassword,
            // input value
            username: username,
            password: password,
            toastShow: 'show',
            toastMsg: 'You have entered wrong password for this username'
          });
        } else {
          passport.authenticate('local')(req, res, function (err) {
            req.session.user = user;
            res.redirect('/');
          });
        }
      });
    } else {
      res.render('sign-in', {
        // validation
        validationUsername: validationUsername,
        validationPassword: validationPassword,
        // input value
        username: username,
        password: password,
        toastShow: 'show',
        toastMsg: 'There is an error, please do check your input'
      });
    }
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
        email: req.body.email,
        phone: req.body.phone,
        profile: ''
      },
      req.body.password,
      function (err, user) {
        if (err) {
          console.log(err);
          res.redirect('/sign-up');
        } else {
          passport.authenticate('local')(req, res, function () {
            res.redirect('/');
          });
        }
      }
    );
  });

//FORGOT PASSWORD
app
  .get('/forgot-password', function (req, res) {
    res.render('forgot-password', {
      validationEmail: '',
      email: '',
      // toast alert
      toastShow: '',
      toastMsg: ''
    });
  })
  .post('/forgot-password', async function (req, res) {
    const email = req.body.email;

    var validationEmail = '';
    var checkEmail = '';
    var userId = '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const user = await User.findOne({ email: email });

    console.log();

    if (user) {
      checkEmail = 'found';
      userId = user._id;
    } else {
      checkEmail = 'not found';
    }

    // email validation
    if (
      email === '' ||
      emailRegex.test(email) === 'incorrect' ||
      checkEmail === 'not found'
    ) {
      validationEmail = 'is-invalid';
    } else {
      validationEmail = 'is-valid';
    }

    if (validationEmail === 'is-valid') {
      const resetPasswordUrl =
        'https://guarded-shore-55159-b88e13b0676b.herokuapp.com/reset-password/' +
        userId;

      let mailOptions = {
        from: 'shrrshazni@gmail.com',
        to: email,
        subject: 'Forgot Password - Reset Your Password',
        html: `
          <html>
            <head>
              <style>
                body {
                  font-family: 'Arial', sans-serif;
                  background-color: #f4f4f4;
                  color: #333;
                }
                h1 {
                  color: #009688;
                }
                p {
                  margin-bottom: 20px;
                }
                a {
                  color: #3498db;
                }
              </style>
            </head>
            <body>
              <h1>Forgot Your Password?</h1>
              <p>No worries! Click the link below to reset your password:</p>
              <p><a href="${resetPasswordUrl}">${resetPasswordUrl}</a></p>
              <p>If you didn't request a password reset, you can ignore this email.</p>
            </body>
          </html>
        `
      };

      // Send mail with defined transport object
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
      });

      res.render('forgot-password', {
        validationEmail: '',
        email: '',
        // toast alert
        toastShow: 'show',
        toastMsg: 'Reset password has been send to your registered email'
      });
    } else {
      res.render('forgot-password', {
        validationEmail: validationEmail,
        email: email,
        // toast alert
        toastShow: 'show',
        toastMsg: 'Your email was not registered, please check your email again'
      });
    }
  });

//RESET PASSWORD

app
  .get('/reset-password/:customNameList', async function (req, res) {
    const userId = req.params.customNameList;
    res.render('reset-password', {
      userId: userId,
      validationNewPassword: '',
      validationConfirmPassword: '',
      newPassword: '',
      confirmPassword: '',
      // alert toast
      toastShow: '',
      toastMsg: ''
    });
  })
  .post('/reset-password/:customNameList', async function (req, res) {
    const userId = req.params.customNameList;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    const passwordRegex = /^(?:\d+|[a-zA-Z0-9]{4,})/;
    var validationNewPassword = '';
    var validationConfirmPassword = '';

    const user = await User.findOne({ _id: userId });

    // New Password
    if (passwordRegex.test(newPassword) === 'false' || newPassword === '') {
      validationNewPassword = 'is-invalid';
    } else {
      validationNewPassword = 'is-valid';
    }

    // Phone
    if (newPassword != confirmPassword) {
      validationConfirmPassword = 'is-invalid';
    } else {
      validationConfirmPassword = 'is-valid';
    }

    if (
      validationNewPassword === 'is-valid' &&
      validationConfirmPassword === 'is-valid'
    ) {
      user.setPassword(newPassword, err => {
        if (err) {
          return res.redirect('/reset-password/' + userId);
        }
        user.save();
        console.log('Set password succesful');
      });

      res.render('sign-in', {
        // validation
        validationUsername: '',
        validationPassword: '',
        // input value
        username: '',
        password: '',
        toastShow: 'show',
        toastMsg: 'You have succesfully set new password'
      });
    } else {
      console.log('There are some error in the input');
      res.render('reset-password', {
        userId: userId,
        validationNewPassword: validationNewPassword,
        validationConfirmPassword: validationConfirmPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
        // alert toast
        toastShow: 'show',
        toastMsg: 'There are some error in your input'
      });
    }
  });

// DASHBOARD

app.get('/dashboard', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    // find all the report here
    const patrolReport = await PatrolReport.find();
    const dutyHandover = await DutyHandover.find();
    const user = await User.find();
    const shiftMember = await PatrolReport.find({
      type: 'Shift Member Location'
    });
    const patrolUnit = await PatrolReport.find({ type: 'Patrol Unit' });
    const caseReport = await CaseReport.find();

    // Find duty handovers for the past week
    const oneWeekAgo = moment().subtract(7, 'days').format('DD/MM/YY');

    const currentDate1 = new Date();

    // Get the current month and year
    const currentMonth = currentDate1.getMonth(); // Months are zero-based
    const currentYear = currentDate1.getFullYear();

    // Calculate the previous month
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Array of month names
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];

    // Format the previous month as a string
    const formattedPreviousMonth = `${monthNames[previousMonth]} ${previousYear}`;
    const formattedCurrentMonth = `${monthNames[currentMonth]} ${currentYear}`;

    const currentDate = dateLocal.getDate();

    if (checkUser) {
      res.render('dashboard', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
        role: checkUser.role,
        // value
        patrolReport: patrolReport,
        dutyHandover: dutyHandover,
        user: user,
        shiftMember: shiftMember,
        patrolUnit: patrolUnit,
        caseReport: caseReport,
        oneWeekAgo: oneWeekAgo,
        currentDate: currentDate,
        currentMonth: formattedCurrentMonth,
        previousMonth: formattedPreviousMonth
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// FETCH DATA FOR CHARTS

// LOCATION

app.get('/api/averagePercentagesByWeek/:location', async (req, res) => {
  try {
    const string = req.params.location;
    const location = _.startCase(string);

    // Fetch patrol report data for the entire year
    const allReports = await PatrolReport.find({
      type: 'Shift Member Location',
      location: location
    });

    // Calculate the date for the month before the current month
    const currentDate = new Date();
    const previousMonth = new Date(currentDate);
    previousMonth.setMonth(currentDate.getMonth() - 1);

    // Filter data for the month before the current month
    const previousMonthData = allReports.filter(report => {
      const [day, month, year] = report.date.split('/').map(Number);
      const reportDate = new Date(`20${year}`, month - 1, day); // Assuming years are in 2-digit format

      return (
        reportDate.getMonth() === previousMonth.getMonth() &&
        reportDate.getFullYear() === previousMonth.getFullYear()
      );
    });

    // Function to get the week number within the month for a given date
    function getWeekNumberWithinMonth(date) {
      const dayOfMonth = date.getDate();

      if (dayOfMonth >= 1 && dayOfMonth <= 7) {
        return 1;
      } else if (dayOfMonth >= 8 && dayOfMonth <= 14) {
        return 2;
      } else if (dayOfMonth >= 15 && dayOfMonth <= 21) {
        return 3;
      } else {
        return 4;
      }
    }

    // Initialize variables to store total checkpoints and checkpoints with time
    let totalCheckpoints = 0;
    let checkpointsWithTime = 0;

    // Create a map to store accumulated data for each week within the month
    const weekDataMap = new Map();

    // Iterate over the filtered reports
    previousMonthData.forEach(report => {
      // Increment total checkpoints
      report.shiftMember.cycle.forEach(cycle => {
        totalCheckpoints += cycle.checkpoint.length;
      });

      // Increment checkpoints with time
      report.shiftMember.cycle.forEach(cycle => {
        cycle.checkpoint.forEach(checkpoint => {
          if (checkpoint.time.trim() !== '') {
            checkpointsWithTime++;
          }
        });
      });

      // Extract date from the report
      const [day, month, year] = report.date.split('/').map(Number);
      const reportDate = new Date(`20${year}`, month - 1, day);

      // Extract week number within the month from the date
      const weekNumber = getWeekNumberWithinMonth(reportDate);

      // Calculate the percentage for the report
      const reportTotalCheckpoints = totalCheckpoints;
      const reportCheckpointsWithTime = checkpointsWithTime;
      const percentage =
        (reportCheckpointsWithTime / reportTotalCheckpoints) * 100 || 0;

      // Accumulate data for each week within the month
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        weekData.totalPercentage += percentage;
        weekData.reportCount++;
      } else {
        weekDataMap.set(weekNumber, {
          totalPercentage: percentage,
          reportCount: 1
        });
      }

      // Reset variables for the next report
      totalCheckpoints = 0;
      checkpointsWithTime = 0;
    });

    // Calculate average percentage for each week within the month
    const averagePercentagesByWeek = [];
    for (let weekNumber = 1; weekNumber <= 4; weekNumber++) {
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        const averagePercentage =
          weekData.totalPercentage / weekData.reportCount;
        averagePercentagesByWeek.push({ weekNumber, averagePercentage });
      } else {
        // If no reports for a specific week, push zero percentage
        averagePercentagesByWeek.push({ weekNumber, averagePercentage: 0 });
      }
    }

    res.json(averagePercentagesByWeek);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// SHIFT MEMBER

app.get('/api/dashboard/shiftMember', async (req, res) => {
  try {
    // Get the start of the current month in 'DD/MM/YY' format
    const startOfMonth = moment().startOf('month').format('DD/MM/YY');

    // Get the current date in 'DD/MM/YY' format
    const currentDate = moment().format('DD/MM/YY');

    const allReports = await PatrolReport.find({
      type: 'Shift Member Location',
      date: {
        $gte: startOfMonth,
        $lte: currentDate
      }
    }).exec();

    // Calculate the week number within the month for a given date
    function getWeekNumberWithinMonth(date) {
      const dayOfMonth = date.getDate();

      if (dayOfMonth >= 1 && dayOfMonth <= 7) {
        return 1;
      } else if (dayOfMonth >= 8 && dayOfMonth <= 14) {
        return 2;
      } else if (dayOfMonth >= 15 && dayOfMonth <= 21) {
        return 3;
      } else {
        return 4;
      }
    }

    // Initialize variables to store total checkpoints and checkpoints with time
    let totalCheckpoints = 0;
    let checkpointsWithTime = 0;

    // Create a map to store accumulated data for each week within the month
    const weekDataMap = new Map();

    // Iterate over the filtered reports
    allReports.forEach(report => {
      // Increment total checkpoints
      report.shiftMember.cycle.forEach(cycle => {
        totalCheckpoints += cycle.checkpoint.length;
      });

      // Increment checkpoints with time
      report.shiftMember.cycle.forEach(cycle => {
        cycle.checkpoint.forEach(checkpoint => {
          if (checkpoint.time.trim() !== '') {
            checkpointsWithTime++;
          }
        });
      });

      const correctFormat = moment(report.date, 'DD/MM/YY').toISOString();

      // Extract date from the report
      const reportDate = new Date(correctFormat);

      // Extract week number within the month from the date
      const weekNumber = getWeekNumberWithinMonth(reportDate);

      // Calculate the percentage for the report
      const reportTotalCheckpoints = totalCheckpoints;
      const reportCheckpointsWithTime = checkpointsWithTime;
      const percentage =
        (reportCheckpointsWithTime / reportTotalCheckpoints) * 100 || 0;

      // Accumulate data for each week within the month
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        weekData.totalPercentage += percentage;
        weekData.reportCount++;
      } else {
        weekDataMap.set(weekNumber, {
          totalPercentage: percentage,
          reportCount: 1
        });
      }

      // Reset variables for the next report
      totalCheckpoints = 0;
      checkpointsWithTime = 0;
    });

    // Calculate average percentage for each week within the month
    const averagePercentagesByWeek = [];
    for (let weekNumber = 1; weekNumber <= 4; weekNumber++) {
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        const averagePercentage =
          weekData.totalPercentage / weekData.reportCount;
        averagePercentagesByWeek.push({ weekNumber, averagePercentage });
      } else {
        // If no reports for a specific week, push zero percentage
        averagePercentagesByWeek.push({ weekNumber, averagePercentage: 0 });
      }
    }

    res.json(averagePercentagesByWeek);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/dashboard/patrolUnit', async (req, res) => {
  try {
    // Get the start of the current month in 'DD/MM/YY' format
    const startOfMonth = moment().startOf('month').format('DD/MM/YY');

    // Get the current date in 'DD/MM/YY' format
    const currentDate = moment().format('DD/MM/YY');

    const allReports = await PatrolReport.find({
      type: 'Patrol Unit',
      date: {
        $gte: startOfMonth,
        $lte: currentDate
      }
    }).exec();

    // Calculate the week number within the month for a given date
    function getWeekNumberWithinMonth(date) {
      const dayOfMonth = date.getDate();

      if (dayOfMonth >= 1 && dayOfMonth <= 7) {
        return 1;
      } else if (dayOfMonth >= 8 && dayOfMonth <= 14) {
        return 2;
      } else if (dayOfMonth >= 15 && dayOfMonth <= 21) {
        return 3;
      } else {
        return 4;
      }
    }

    // Initialize variables to store total checkpoints and checkpoints with time
    let totalCheckpoints = 0;
    let checkpointsWithTime = 0;

    // Create a map to store accumulated data for each week within the month
    const weekDataMap = new Map();

    // Iterate over the filtered reports
    allReports.forEach(report => {
      // Increment total checkpoints
      report.patrolUnit.forEach(cycle => {
        totalCheckpoints += cycle.checkpointName.length;
      });

      // Increment checkpoints with time
      report.patrolUnit.forEach(cycle => {
        if (cycle.time.trim() !== '') {
          checkpointsWithTime++;
        }
      });

      const correctFormat = moment(report.date, 'DD/MM/YY').toISOString();

      // Extract date from the report
      const reportDate = new Date(correctFormat);

      // Extract week number within the month from the date
      const weekNumber = getWeekNumberWithinMonth(reportDate);

      // Calculate the percentage for the report
      const reportTotalCheckpoints = totalCheckpoints;
      const reportCheckpointsWithTime = checkpointsWithTime;
      const percentage =
        (reportCheckpointsWithTime / reportTotalCheckpoints) * 100 || 0;

      // Accumulate data for each week within the month
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        weekData.totalPercentage += percentage;
        weekData.reportCount++;
      } else {
        weekDataMap.set(weekNumber, {
          totalPercentage: percentage,
          reportCount: 1
        });
      }

      // Reset variables for the next report
      totalCheckpoints = 0;
      checkpointsWithTime = 0;
    });

    // Calculate average percentage for each week within the month
    const averagePercentagesByWeek = [];
    for (let weekNumber = 1; weekNumber <= 4; weekNumber++) {
      if (weekDataMap.has(weekNumber)) {
        const weekData = weekDataMap.get(weekNumber);
        const averagePercentage =
          weekData.totalPercentage / weekData.reportCount;
        averagePercentagesByWeek.push({ weekNumber, averagePercentage });
      } else {
        // If no reports for a specific week, push zero percentage
        averagePercentagesByWeek.push({ weekNumber, averagePercentage: 0 });
      }
    }

    res.json(averagePercentagesByWeek);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/dutyHandovers', async (req, res) => {
  try {
    // Inside the route handler
    const currentDate = moment().format('DD/MM/YY');

    // Use these formatted dates in your MongoDB query
    const dutyHandovers = await DutyHandover.find({
      date: currentDate
    });

    const completedCount = dutyHandovers.filter(
      item => item.status === 'Completed'
    ).length;

    const incompletedCount = dutyHandovers.filter(
      item => item.status === 'Incompleted'
    ).length;

    res.json({ completedCount, incompletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ACTIVITY
const ActivitySchema = new mongoose.Schema({
  date: String,
  items: []
});

const Activity = mongoose.model('Activity', ActivitySchema);

// FILES SCHEMA MODEL
const FileSchema = new mongoose.Schema({
  reportId: String,
  by: String,
  filename: String,
  path: String,
  date: String,
  fileType: String
});

const File = mongoose.model('File', FileSchema);

// PATROL REPORT SECTION
const checkpoint = {
  latitude: Number,
  longitude: Number,
  checkpointName: String,
  time: String,
  logReport: String,
  fullName: String,
  username: String
};
const cycleAmount = {
  cycleSeq: Number,
  timeSlot: String,
  checkpoint: [checkpoint]
};
const shiftMember = {
  cycle: [cycleAmount]
};

// PATROL SCHEMA
const patrolReportSchema = new mongoose.Schema({
  reportId: String,
  shift: String,
  type: String,
  date: String,
  location: String,
  status: String,
  startShift: String,
  endShift: String,
  summary: String,
  notes: String,
  staff: [],
  shiftMember: shiftMember,
  patrolUnit: [checkpoint]
});

const PatrolReport = mongoose.model('PatrolReport', patrolReportSchema);

// UPLOAD FILES PATROL REPORT
app.post('/upload-patrol', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('There is no files selected');
  } else {
    // find user full name
    const currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    // find rid
    const confirmRid = req.body.fileReportId;

    // date for upload
    var uploadDate = dateLocal.getDateYear();
    var uploadTime = getKualaLumpurTime();

    // Activity
    const newItemActivity = {
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in patrol report'
    };

    const newActivity = new Activity({
      date: uploadDate,
      items: newItemActivity
    });

    // Check if the report ID exists in the database
    const existingFile = await File.findOne({ reportId: confirmRid });

    if (!existingFile) {
      const findDate = await Activity.findOne({ date: uploadDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity was added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }

      // No file with the report ID found, proceed with file upload
      for (const file of Object.values(req.files)) {
        const uploadPath = __dirname + '/public/uploads/' + file.name;
        const pathFile = 'uploads/' + file.name;
        const todayDate = dateLocal.getDate();
        const fileType = path.extname(file.name);

        file.mv(uploadPath, err => {
          if (err) {
            console.log(err);
          }

          // Save file information to the MongoDB
          const newFile = new File({
            reportId: confirmRid,
            by: checkUser.fullname,
            filename: file.name,
            path: pathFile,
            date: todayDate,
            fileType: fileType
          });

          newFile.save();
        });
      }
      res.redirect('/shift-member/details?id=' + confirmRid);
    } else {
      // File with the report ID already exists
      res.redirect('/shift-member/details?id=' + confirmRid);
    }
  }
});

// SHIFT MEMBER

// VIEW
app.get('/shift-member/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await PatrolReport.find({
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemBMI = await PatrolReport.find({
        location: 'Baitul Makmur I',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemJM = await PatrolReport.find({
        location: 'Jamek Mosque',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemCM = await PatrolReport.find({
        location: 'City Mosque',
        type: 'Shift Member Location'
      }).sort({
        date: -1
      });
      const itemRS = await PatrolReport.find({
        location: 'Raudhatul Sakinah',
        type: 'Shift Member Location'
      }).sort({ date: -1 });

      // Extract shift members from the result
      const allShiftMembers = itemReports.reduce((members, report) => {
        if (report.shiftMember && report.shiftMember.length > 0) {
          members.push(...report.shiftMember);
        }
        return members;
      }, []);

      if (itemReports.length > 0) {
        res.render('shift-member-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: itemReports,
          shiftMembers: allShiftMembers,
          totalReports: itemReports.length,
          amountBMI: itemBMI.length,
          amountBMII: itemBMII.length,
          amountJM: itemJM.length,
          amountCM: itemCM.length,
          amountRS: itemRS.length,
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      } else {
        res.render('shift-member-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: 'There is no patrol report submitted yet.',
          totalReports: '0',
          amountBMI: '0',
          amountBMII: '0',
          amountJM: '0',
          amountCM: '0',
          amountRS: '0',
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

app.get('/shift-member/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await PatrolReport.find({
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemBMI = await PatrolReport.find({
        location: 'Baitul Makmur I',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemJM = await PatrolReport.find({
        location: 'Jamek Mosque',
        type: 'Shift Member Location'
      }).sort({ date: -1 });
      const itemCM = await PatrolReport.find({
        location: 'City Mosque',
        type: 'Shift Member Location'
      }).sort({
        date: -1
      });
      const itemRS = await PatrolReport.find({
        location: 'Raudhatul Sakinah',
        type: 'Shift Member Location'
      }).sort({ date: -1 });

      // check customlistname
      if (customListName === 'BMI') {
        // view for baitul makmur 1
        if (itemReports.length > 0) {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMI,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no patrol report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'BMII') {
        // view for baitul makmur 2
        if (itemReports.length > 0) {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMII,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no patrol report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'JM') {
        // view for jamek mosque
        if (itemReports.length > 0) {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemJM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no patrol report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'CM') {
        // view for city mosque
        if (itemReports.length > 0) {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemCM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no patrol report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'RS') {
        // view for raudhatul sakinah
        if (itemReports.length > 0) {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemRS,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('shift-member-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no patrol report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.redirect('/home');
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// DETAILS
app.get('/shift-member/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const reportId = req.query.id;

    if (checkUser) {
      const checkReport = await PatrolReport.findOne({
        reportId: reportId
      });

      const shiftMemberCycles = checkReport.shiftMember.cycle;

      const currentTime = new Date().toLocaleTimeString('en-MY', {
        hour12: false,
        timeZone: 'Asia/Kuala_Lumpur'
      });
      const currentTimeNumeric = parseInt(currentTime.replace(':', ''), 10);

      for (const cycle of shiftMemberCycles) {
        const startTimeNumeric = parseInt(cycle.timeSlot.split('-')[0], 10);
        const endTimeNumeric = parseInt(cycle.timeSlot.split('-')[1], 10);

        console.log(startTimeNumeric);
        console.log(endTimeNumeric);

        if (cycle.timeSlot === '2300-0000') {
          if (
            currentTimeNumeric >= startTimeNumeric &&
            currentTimeNumeric >= endTimeNumeric
          ) {
            var currentTimeSlot = cycle.timeSlot;
            break;
          }
        } else {
          if (
            currentTimeNumeric >= startTimeNumeric &&
            currentTimeNumeric <= endTimeNumeric
          ) {
            var currentTimeSlot = cycle.timeSlot;
            break;
          }
        }
      }

      if (currentTimeSlot === undefined) {
        // Handle the case when no matching time slot is found
        console.log('No matching time slot found.');
      }

      // Function to count times with values in a cycle
      function countTimesWithValuesInCycle(cycle) {
        let timesWithValuesCount = 0;

        for (const checkpoint of cycle.checkpoint) {
          // Check if the time property has a non-empty value
          if (checkpoint.time && checkpoint.time.trim() !== '') {
            timesWithValuesCount++;
          }
        }

        return timesWithValuesCount;
      }

      // Function to count total times in a cycle
      function countTotalTimesInCycle(cycle) {
        return cycle.checkpoint.length;
      }

      // Function to count total times with values in all cycles
      function countTotalTimesWithValuesInShift(shiftMemberCycles) {
        let totalTimesWithValuesInShift = 0;
        let totalTimesInShift = 0;

        for (const cycle of shiftMemberCycles) {
          totalTimesWithValuesInShift += countTimesWithValuesInCycle(cycle);
          totalTimesInShift += countTotalTimesInCycle(cycle);
        }

        return { totalTimesWithValuesInShift, totalTimesInShift };
      }

      // Count total times with values and total times in the shift
      const { totalTimesWithValuesInShift, totalTimesInShift } =
        countTotalTimesWithValuesInShift(shiftMemberCycles);

      // Calculate percentage
      const percentageTimesWithValuesInShift =
        (totalTimesWithValuesInShift / totalTimesInShift) * 100;

      if (checkReport) {
        const checkFiles = await File.find({ reportId: reportId });

        if (checkFiles.length > 0) {
          res.render('shift-member-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            patrolReport: checkReport,
            reportId: reportId,
            cycle: shiftMemberCycles,
            currentTimeSlot: currentTimeSlot,
            progressReport: percentageTimesWithValuesInShift.toFixed(0),
            // files
            files: checkFiles
          });
        } else {
          res.render('shift-member-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            patrolReport: checkReport,
            reportId: reportId,
            cycle: shiftMemberCycles,
            currentTimeSlot: currentTimeSlot,
            progressReport: percentageTimesWithValuesInShift.toFixed(0),
            // files
            files: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.render('shift-member-details', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          // patrol report
          patrolReport: '',
          cycle: '',
          currentTimeSlot: '',
          progressReport: '',
          reportId: reportId,
          // files
          files: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SELECTION FULL NAME FROM QR SCANNER
app.get(
  '/shift-member/fullname-submit/:location/:checkpointName',
  async function (req, res) {
    // init the params from the link
    const location = _.startCase(req.params.location.replace(/-/g, ' '));

    // init the params from the link
    const checkpointName = _.startCase(
      req.params.checkpointName.replace(/-/g, ' ')
    );

    const today = moment().format('DD/MM/YY');
    const yesterday = moment().subtract(1, 'days').format('DD/MM/YY');

    console.log('Today:', today);
    console.log('Yesterday:', yesterday);

    const kualaLumpurTimeZoneOffset1 = 8; // Kuala Lumpur is UTC+8
    const now1 = moment().utcOffset(kualaLumpurTimeZoneOffset1 * 60); // Convert hours to minutes

    // Get the current time in the Asia/Kuala_Lumpur timezone
    const currentTimeNumeric = now1.format('HHmm');

    // Check if the current time is between 2300 and 0700
    const isNightShift = currentTimeNumeric >= 2300 || currentTimeNumeric < 700;

    if (isNightShift) {
      const filteredReports1 = await PatrolReport.findOne({
        location: location,
        startShift: '2300',
        $or: [{ date: today }, { date: yesterday }]
      });

      console.log(filteredReports1);

      res.render('shift-member-submit', {
        patrolReport: filteredReports1,
        location: location,
        checkpointName: checkpointName
      });
    } else {
      const filteredReports2 = await PatrolReport.findOne({
        location: location,
        date: today,
        startShift: { $lte: currentTimeNumeric },
        endShift: { $gte: currentTimeNumeric }
      });

      console.log(filteredReports2);

      res.render('shift-member-submit', {
        patrolReport: filteredReports2,
        location: location,
        checkpointName: checkpointName
      });
    }
  }
);

// SUBMIT DATA USING QR SCANNER
app.get(
  '/shift-member/checkpoint-submit/:location/:checkpointName/:shiftMember/:reportId',
  async function (req, res) {
    const checkUser = await User.findOne({ fullname: req.params.shiftMember });

    const reportId = req.params.reportId;

    console.log(reportId);

    // init the params from the link
    const checkpointName = _.startCase(
      req.params.checkpointName.replace(/-/g, ' ')
    );
    // init the params from the link
    const location = _.startCase(req.params.location.replace(/-/g, ' '));

    if (checkUser) {
      // Find a patrol report where the staff array contains the user's full name
      const patrolReport = await PatrolReport.findOne({
        reportId: reportId
      });

      if (patrolReport && patrolReport.status === 'Open') {
        // Find the relevant cycle based on your logic and checkpointName
        const cycleToUpdate = patrolReport.shiftMember.cycle.find(cycle =>
          cycle.checkpoint.some(
            checkpoint =>
              checkpoint.checkpointName === checkpointName &&
              isWithinTimeSlot(cycle.timeSlot)
          )
        );

        // Function to check if the current time is within the given time slot
        function isWithinTimeSlot(timeSlot) {
          // Parse the start and end times from the time slot
          const [startTime, endTime] = timeSlot.split('-');

          // Get the current time in numeric format (e.g., HHmm)
          const currentTimeNumeric = new Date().toLocaleTimeString('en-MY', {
            hour12: false,
            timeZone: 'Asia/Kuala_Lumpur'
          });
          const currentTime = parseInt(currentTimeNumeric.replace(':', ''), 10);

          var startNumeric = '';
          var endNumeric = '';

          // Convert start and end times to numeric format
          startNumeric = parseInt(startTime.replace(':', ''), 10);
          endNumeric = parseInt(endTime.replace(':', ''), 10);

          if (endNumeric === 0) {
            endNumeric = 2400;
          }

          if (startNumeric <= endNumeric) {
            return currentTime >= startNumeric && currentTime <= endNumeric;
          } else {
            // Handle the case where the time slot spans midnight
            return currentTime >= startNumeric || currentTime <= endNumeric;
          }
        }

        if (cycleToUpdate) {
          // Find the checkpoint with the matching checkpointName
          const checkpointToUpdate = cycleToUpdate.checkpoint.find(
            checkpoint => checkpoint.checkpointName === checkpointName
          );

          if (checkpointToUpdate) {
            // Get the current time in numeric format (e.g., HHmm)
            const currentTimeNumeric1 = new Date().toLocaleTimeString('en-MY', {
              hour12: false,
              timeZone: 'Asia/Kuala_Lumpur'
            });
            const currentTime1 = parseInt(
              currentTimeNumeric1.replace(':', ''),
              10
            );

            const inputString = checkUser.fullname;

            // Update the time in the found checkpoint with the current time
            checkpointToUpdate.time = currentTime1 + 'HRS';
            checkpointToUpdate.logReport =
              checkpointName +
              ' have been patrol by ' +
              inputString +
              ' at ' +
              currentTime1 +
              'HRS';
            checkpointToUpdate.username = checkUser.username;
            checkpointToUpdate.fullName = inputString;

            // date for upload
            var uploadDate = dateLocal.getDateYear();
            var uploadTime = getKualaLumpurTime();

            // Activity
            const newItemActivity = {
              time: uploadTime,
              by: checkUser.fullname,
              username: checkUser.username,
              type: 'Patrol Report',
              title: 'Shift Member Location',
              about:
                'Has patrol near ' +
                checkpointName +
                ' in ' +
                location +
                ' at ' +
                currentTime1 +
                'HRS'
            };

            const newActivity = new Activity({
              date: uploadDate,
              items: newItemActivity
            });

            const findDate = await Activity.findOne({ date: uploadDate });

            if (findDate) {
              findDate.items.push(newItemActivity);
              await findDate.save();
              console.log('Activity was added to existing date');
            } else {
              const resultActivity = Activity.create(newActivity);

              if (resultActivity) {
                console.log('Added new activity');
              } else {
                console.log('Something is wrong');
              }
            }

            // Save the changes to the database
            await patrolReport.save();

            console.log('Successful update using QR scanner!');

            res.render('submit-success');
          } else {
            console.log('Checkpoint not found in the cycle.');
            res.render('submit-failed');
          }
        } else {
          console.log('Cycle not found.');
          res.render('submit-failed');
        }
      } else {
        console.log(
          'No patrol report found for the user or the patrol report is already closed.'
        );
        res.render('submit-failed');
      }
    }
  }
);

// SUBMIT SUCCESS

app.get('/submit-success', async function (req, res) {
  res.render('submit-success');
});

app.get('/submit-failed', async function (req, res) {
  res.render('submit-failed');
});

// ECHARTS
// FETCH DATA
app.get('/shift-member/echarts-data/:reportId', async (req, res) => {
  const reportId = req.params.reportId;

  try {
    const patrolReport = await PatrolReport.findOne({ reportId });

    if (!patrolReport) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const echartsData = {
      cycle: patrolReport.shiftMember.cycle.map(cycle => {
        const checkpoints = cycle.checkpoint.map(checkpoint => ({
          time: checkpoint.time
          // Include other checkpoint properties as needed
        }));

        const totalCheckpoints = checkpoints.length;
        const checkpointsWithTime = checkpoints.filter(
          checkpoint =>
            checkpoint.time !== undefined &&
            checkpoint.time !== null &&
            checkpoint.time !== ''
        );
        const checkpointsWithTimeCount = checkpointsWithTime.length;
        const percentageWithTime =
          (checkpointsWithTimeCount / totalCheckpoints) * 100 || 0;

        return {
          cycleSeq: cycle.cycleSeq,
          timeSlot: cycle.timeSlot,
          totalCheckpoints,
          checkpointsWithTimeCount,
          percentageWithTime
        };
      })
    };

    res.status(200).json({ success: true, status: 200, data: echartsData });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/chart/:reportId', async (req, res) => {
  try {
    const reportId = req.params.reportId;

    // Fetch data from the database using findOne
    const patrolReport = await PatrolReport.findOne({ reportId: reportId });

    // Check if a patrol report was found
    if (patrolReport) {
      // Extract staff names from the first patrol report
      const staffNames = patrolReport.staff || [];

      // Initialize an array to store staff presence counts for each cycle
      const staffPresenceCountsPerCycle = [];

      // Loop through each cycle in shiftMember
      for (const cycle of patrolReport.shiftMember?.cycle || []) {
        // Initialize staff presence count map for the current cycle
        const staffPresenceCount = new Map(staffNames.map(name => [name, 0]));

        // Loop through each checkpoint in the current cycle
        for (const checkpoint of cycle.checkpoint || []) {
          if (staffNames.includes(checkpoint.fullName)) {
            staffPresenceCount.set(
              checkpoint.fullName,
              staffPresenceCount.get(checkpoint.fullName) + 1
            );
          }
        }

        // Get the presence count for each staff name for the current cycle
        const staffPresenceCounts = staffNames.map(
          name => staffPresenceCount.get(name) || 0
        );

        // Add the staff presence counts for the current cycle to the array
        staffPresenceCountsPerCycle.push(staffPresenceCounts);
      }

      console.log(staffPresenceCountsPerCycle);

      // Send data as JSON
      res.json({
        staffNames,
        staffPresenceCountsPerCycle,
        totalCycles: staffPresenceCountsPerCycle.length
      });
    } else {
      // Handle the case where the patrol report with the given reportId is not found
      res.status(404).json({ error: 'Patrol report not found' });
    }
  } catch (error) {
    console.error('Error fetching data from the database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/patrolData/:reportId', async (req, res) => {
  try {
    const patrolReportDocument = await PatrolReport.findOne({
      reportId: req.params.reportId
    });

    const cycles = patrolReportDocument.shiftMember.cycle;

    // Initialize checkpoint data object
    const checkpointData = {};

    // Iterate through cycles to count occurrences
    cycles.forEach(cycle => {
      cycle.checkpoint.forEach(checkpoint => {
        const checkpointName = checkpoint.checkpointName;

        // Initialize if not exists
        if (!checkpointData[checkpointName]) {
          checkpointData[checkpointName] = { total: 0, withTime: 0 };
        }

        // Increment total count
        checkpointData[checkpointName].total++;

        // Increment withTime count if time is present
        if (checkpoint.time !== '') {
          checkpointData[checkpointName].withTime++;
        }
      });
    });

    // Calculate total number of checkpoints and those with time value
    const totalCheckpoints = Object.values(checkpointData).reduce(
      (total, data) => total + data.total,
      0
    );

    const checkpointsWithTime = Object.values(checkpointData).reduce(
      (total, data) => total + data.withTime,
      0
    );

    // Calculate percentage for each checkpoint
    const checkpointPercentageData = {};
    Object.keys(checkpointData).forEach(checkpointName => {
      const total = checkpointData[checkpointName].total;
      const withTime = checkpointData[checkpointName].withTime;
      const percentage = total === 0 ? 0 : (withTime / total) * 100;

      checkpointPercentageData[checkpointName] = {
        total,
        withTime,
        percentage
      };
    });

    // Calculate overall percentage
    const percentage =
      totalCheckpoints === 0
        ? 0
        : (checkpointsWithTime / totalCheckpoints) * 100;

    const result = {
      checkpointPercentageData,
      totalCheckpoints,
      checkpointsWithTime,
      percentage
    };

    console.log(result);

    res.json(result);
  } catch (error) {
    console.error('Error fetching patrol data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATROL UNIT

// SCHEDULER SUBMIT EVERYDAY 8 AM
const scheduler = async data => {
  const submitData = await PatrolReport.create(data);

  if (submitData) {
    console.log('Patrol unit submitted');
  } else {
    console.log('Error');
  }
};

// INSERT PATROL UNIT DATA WITH 4 CHECKPOINT
cron.schedule(
  '00 08 * * *',
  () => {
    const dateToday = dateLocal.getDate();
    const checkpointData = [
      {
        checkpointName: 'Mufti Residence',
        logReport: '',
        time: ''
      },
      {
        checkpointName: 'Encik Drahman Residence',
        logReport: '',
        time: ''
      },
      {
        checkpointName: 'Ceo Residence',
        logReport: '',
        time: ''
      },
      {
        checkpointName: 'Sicc',
        logReport: '',
        time: ''
      }
    ];

    const patrolUnitData = {
      reportId: crypto.randomBytes(6).toString('hex').toUpperCase(),
      type: 'Patrol Unit',
      date: dateToday,
      status: 'Open',
      startShift: '08:00',
      endShift: '17:00',
      notes: '',
      patrolUnit: checkpointData
    };

    scheduler(patrolUnitData);
  },
  {
    scheduled: true,
    timezone: 'Asia/Kuala_Lumpur' // Set the timezone to Malaysia
  }
);

cron.schedule(
  '00 17 * * *',
  async () => {
    try {
      const dateToday = dateLocal.getDate();

      console.log(dateToday);

      // Update status of Patrol Reports with today's date to 'Closed'
      const patrolUnit = await PatrolReport.findOneAndUpdate(
        { date: dateToday, status: 'Open' },
        { $set: { status: 'Closed' } }
      );

      if (patrolUnit) {
        console.log(
          `Patrol Reports for date ${dateToday} updated and closed at 5 PM`
        );
      } else {
        console.log(`Failed to update`);
      }
    } catch (error) {
      console.error('Error in scheduled task at 5 PM:', error);
    }
  },
  {
    scheduled: true,
    timezone: 'Asia/Kuala_Lumpur'
  }
);

// VIEW
app.get('/patrol-unit/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await PatrolReport.find({
        type: 'Patrol Unit'
      }).sort({ date: -1 });
      const itemBMI = await PatrolReport.find({
        location: 'Baitul Makmur I',
        type: 'Patrol Unit'
      }).sort({ date: -1 });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II',
        type: 'Patrol Unit'
      }).sort({ date: -1 });
      const itemJM = await PatrolReport.find({
        location: 'Jamek Mosque',
        type: 'Patrol Unit'
      }).sort({ date: -1 });
      const itemCM = await PatrolReport.find({
        location: 'City Mosque',
        type: 'Patrol Unit'
      }).sort({
        date: -1
      });
      const itemRS = await PatrolReport.find({
        location: 'Raudhatul Sakinah',
        type: 'Patrol Unit'
      }).sort({ date: -1 });

      // Extract shift members from the result
      const allShiftMembers = itemReports.reduce((members, report) => {
        if (report.shiftMember && report.shiftMember.length > 0) {
          members.push(...report.shiftMember);
        }
        return members;
      }, []);

      if (itemReports.length > 0) {
        res.render('patrol-unit-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: itemReports,
          shiftMembers: allShiftMembers,
          totalReports: itemReports.length,
          amountBMI: itemBMI.length,
          amountBMII: itemBMII.length,
          amountJM: itemJM.length,
          amountCM: itemCM.length,
          amountRS: itemRS.length,
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      } else {
        res.render('patrol-unit-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: 'There is no patrol report submitted yet.',
          totalReports: '0',
          amountBMI: '0',
          amountBMII: '0',
          amountJM: '0',
          amountCM: '0',
          amountRS: '0',
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

app.get('/patrol-unit/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const reportId = req.query.id;

    if (checkUser) {
      const checkReport = await PatrolReport.findOne({
        reportId: reportId
      });

      // Check for amount of time for checkpoint being submit or not
      let nonEmptyTimeCount = 0;
      const totalPatrolUnits = checkReport.patrolUnit.length;

      console.log(checkReport.patrolUnit.length);

      // Check each patrol unit for non-empty time
      checkReport.patrolUnit.forEach(patrolUnit => {
        if (patrolUnit.time && patrolUnit.time.trim() !== '') {
          nonEmptyTimeCount++;
        }
      });

      const percentageNonEmptyTime =
        (nonEmptyTimeCount / totalPatrolUnits) * 100;

      // check result and render
      if (checkReport) {
        const checkFiles = await File.find({ reportId: reportId });

        if (checkFiles.length > 0) {
          res.render('patrol-unit-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            patrolReport: checkReport,
            percentage: percentageNonEmptyTime.toString(),
            reportId: reportId,
            // files
            files: checkFiles
          });
        } else {
          res.render('patrol-unit-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            patrolReport: checkReport,
            percentage: percentageNonEmptyTime.toString(),
            reportId: reportId,
            // files
            files: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.render('patrol-unit-details', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          // patrol report
          patrolReport: '',
          percentage: '',
          reportId: reportId,
          // files
          files: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// MAP
// SUBMIT CHECKPOINT DATA WITH QR SCAN
app.get(
  '/patrol-unit/checkpoint-submit/:checkpointName/:longitude/:latitude',
  async function (req, res) {
    const dateToday = dateLocal.getDate();
    const kualaLumpurTimeZoneOffset1 = 8; // Kuala Lumpur is UTC+8
    const now1 = moment().utcOffset(kualaLumpurTimeZoneOffset1 * 60); // Convert hours to minutes

    // Get the current time in the Asia/Kuala_Lumpur timezone
    const time = now1.format('HHmm') + 'HRS';

    console.log(dateToday);

    const checkpointName = _.startCase(
      req.params.checkpointName.replace(/-/g, ' ')
    );
    const currentLongitude = req.params.longitude;
    const currentLatitude = req.params.latitude;

    const logReport = 'Have patrol this area at ' + time;

    const updatedCheckpointData = {
      time: time, // Replace with the new time
      longitude: currentLongitude, // Replace with the new longitude
      latitude: currentLatitude, // Replace with the new latitude
      logReport: logReport
    };

    // Find the patrol report by ID and update the specific checkpoint in the patrolUnit array
    const checkPatrolUnit = await PatrolReport.findOneAndUpdate(
      {
        type: 'Patrol Unit',
        date: dateToday,
        'patrolUnit.checkpointName': checkpointName
      },
      {
        $set: {
          'patrolUnit.$.time': updatedCheckpointData.time,
          'patrolUnit.$.longitude': updatedCheckpointData.longitude,
          'patrolUnit.$.latitude': updatedCheckpointData.latitude,
          'patrolUnit.$.logReport': updatedCheckpointData.logReport
        }
      },
      { new: true, useFindAndModify: false }
    );

    if (checkPatrolUnit.status === 'Open' && checkPatrolUnit) {
      // date for upload
      var uploadDate = dateLocal.getDateYear();
      var uploadTime = getKualaLumpurTime();

      // Activity
      const newItemActivity = {
        time: uploadTime,
        by: 'Patrol Staff',
        type: 'Patrol Report',
        title: 'Patrol Unit',
        about: 'Has patrol near ' + checkpointName + ' at ' + time
      };

      const newActivity = new Activity({
        date: uploadDate,
        items: newItemActivity
      });

      const findDate = await Activity.findOne({ date: uploadDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity was added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }
      console.log(checkPatrolUnit.reportId);

      console.log(
        'Successfully update on patrol unit for ' +
          dateToday +
          ' at ' +
          checkpointName
      );
      res.redirect('/patrol-unit/details?id=' + checkPatrolUnit.reportId);
    } else {
      console.log('Unsuccessful update the qr data due to closed status!');
      res.redirect('/patrol-unit/details?id=' + checkPatrolUnit.reportId);
    }
  }
);

// GET COORDINATES FROM DATABASE
app.get('/map-coordinates/:reportId', async (req, res) => {
  const reportId = req.params.reportId;

  try {
    // Use findOne to find a single report based on the reportId
    const patrolReport = await PatrolReport.findOne({ reportId });

    if (!patrolReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Extract checkpoint coordinates within the patrolReport and format them
    const checkpointCoordinates = patrolReport.patrolUnit.map(checkpoint => [
      checkpoint.longitude,
      checkpoint.latitude
    ]);

    // Send the retrieved checkpoint coordinates as JSON
    res.json(checkpointCoordinates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CASE REPORT

// CASE SCHEMA/MODEL
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
  staffOnDuty: String,
  notes: String
});

const CaseReport = mongoose.model('CaseReport', caseReportSchema);

// UPLOAD FILES CASE REPORT
app.post('/upload-case', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('There is no files selected');
  } else {
    // find user full name
    const currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    // find rid
    const confirmRid = req.body.fileReportId;

    // date for upload
    var uploadDate = dateLocal.getDateYear();
    var uploadTime = getKualaLumpurTime();

    // Activity
    const newItemActivity = {
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in case report'
    };

    const newActivity = new Activity({
      date: uploadDate,
      items: newItemActivity
    });

    // Check if the report ID exists in the database
    const existingFile = await File.findOne({ reportId: confirmRid });

    if (!existingFile) {
      const findDate = await Activity.findOne({ date: uploadDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity was added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }

      // No file with the report ID found, proceed with file upload
      for (const file of Object.values(req.files)) {
        const uploadPath = __dirname + '/public/uploads/' + file.name;
        const pathFile = 'uploads/' + file.name;
        const todayDate = dateLocal.getDate();
        const fileType = path.extname(file.name);

        file.mv(uploadPath, err => {
          if (err) {
            console.log(err);
          }

          // Save file information to the MongoDB
          const newFile = new File({
            reportId: confirmRid,
            by: checkUser.fullname,
            filename: file.name,
            path: pathFile,
            date: todayDate,
            fileType: fileType
          });

          newFile.save();
        });
      }
      res.redirect('/case-report/details?id=' + confirmRid);
    } else {
      // File with the report ID already exists
      res.redirect('/case-report/details?id=' + confirmRid);
    }
  }
});

// VIEW
app.get('/case-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    var itemReports = '';
    var itemBMI = '';
    var itemBMII = '';
    var itemJM = '';
    var itemCM = '';
    var itemRS = '';

    if (checkUser) {
      if (checkUser.role === 'Admin') {
        itemReports = await CaseReport.find({}).sort({ date: -1 });
        itemBMI = await CaseReport.find({
          location: 'Baitul Makmur I'
        }).sort({ date: -1 });
        itemBMII = await CaseReport.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        itemJM = await CaseReport.find({
          location: 'Jamek Mosque'
        }).sort({ date: -1 });
        itemCM = await CaseReport.find({
          location: 'City Mosque'
        }).sort({ date: -1 });
        itemRS = await CaseReport.find({
          location: 'Raudhatul Sakinah'
        }).sort({ date: -1 });
      } else {
        itemReports = await CaseReport.find({
          username: checkUser.username
        }).sort({ date: -1 });
        itemBMI = await CaseReport.find({
          location: 'Baitul Makmur I',
          username: checkUser.username
        }).sort({ date: -1 });
        itemBMII = await CaseReport.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        itemJM = await CaseReport.find({
          location: 'Jamek Mosque',
          username: checkUser.username
        }).sort({ date: -1 });
        itemCM = await CaseReport.find({
          location: 'City Mosque',
          username: checkUser.username
        }).sort({ date: -1 });
        itemRS = await CaseReport.find({
          location: 'Raudhatul Sakinah',
          username: checkUser.username
        }).sort({ date: -1 });
      }

      if (itemReports.length > 0) {
        res.render('case-report-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: itemReports,
          totalReports: itemReports.length,
          amountBMI: itemBMI.length,
          amountBMII: itemBMII.length,
          amountJM: itemJM.length,
          amountCM: itemCM.length,
          amountRS: itemRS.length,
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      } else {
        res.render('case-report-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: 'There is no case report submitted yet.',
          totalReports: '0',
          amountBMI: '0',
          amountBMII: '0',
          amountJM: '0',
          amountCM: '0',
          amountRS: '0',
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// VIEW CUSTOM NAME LIST BASED ON LOCATIONS
app.get('/case-report/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);
    var itemReports = '';

    if (checkUser) {
      if (checkUser.role === 'Admin') {
        itemReports = await CaseReport.find({}).sort({ date: -1 });
        itemBMI = await CaseReport.find({
          location: 'Baitul Makmur I'
        }).sort({ date: -1 });
        itemBMII = await CaseReport.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        itemJM = await CaseReport.find({
          location: 'Jamek Mosque'
        }).sort({ date: -1 });
        itemCM = await CaseReport.find({
          location: 'City Mosque'
        }).sort({ date: -1 });
        itemRS = await CaseReport.find({
          location: 'Raudhatul Sakinah'
        }).sort({ date: -1 });
      } else {
        itemReports = await CaseReport.find({
          username: checkUser.username
        }).sort({ date: -1 });
        itemBMI = await CaseReport.find({
          location: 'Baitul Makmur I',
          username: checkUser.username
        }).sort({ date: -1 });
        itemBMII = await CaseReport.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        itemJM = await CaseReport.find({
          location: 'Jamek Mosque',
          username: checkUser.username
        }).sort({ date: -1 });
        itemCM = await CaseReport.find({
          location: 'City Mosque',
          username: checkUser.username
        }).sort({ date: -1 });
        itemRS = await CaseReport.find({
          location: 'Raudhatul Sakinah',
          username: checkUser.username
        }).sort({ date: -1 });
      }

      // check customlistname
      if (customListName === 'BMI') {
        // view for baitul makmur 1
        if (itemReports.length > 0) {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMI,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'BMII') {
        // view for baitul makmur 2
        if (itemReports.length > 0) {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMII,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'JM') {
        // view for jamek mosque
        if (itemReports.length > 0) {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemJM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'CM') {
        // view for city mosque
        if (itemReports.length > 0) {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemCM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'RS') {
        // view for raudhatul sakinah
        if (itemReports.length > 0) {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemRS,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.redirect('/home');
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SUBMIT REPORT FORM
app
  .get('/case-report/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      const currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      const confirmRid = req.query.rid;

      if (checkUser) {
        res.render('case-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: confirmRid,
          //validation
          validationReportType: '',
          validationTime: '',
          validationDate: '',
          validationLocation: '',
          validationReportSummary: '',
          validationActionTaken: '',
          validationEventSummary: '',
          validationStaffOnDuty: '',
          //form name
          reportType: '',
          time: '',
          date: '',
          location: '',
          reportSummary: '',
          actionTaken: '',
          eventSummary: '',
          staffOnDuty: '',
          //toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/case-report/submit', async function (req, res) {
    var validationReportType = '';
    var validationTime = '';
    var validationDate = '';
    var validationLocation = '';
    var validationActionTaken = '';
    var validationEventSummary = '';
    var validationStaffOnDuty = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const reportType = req.body.reportType;
    const time = req.body.time;
    const location = req.body.location;
    const date = req.body.date;
    const actionTaken = req.body.actionTaken;
    const eventSummary = req.body.eventSummary;
    const staffOnDuty = req.body.staffs;

    // generated rid
    const confirmRid = req.body.confirmRid;

    const currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the reportType
    if (!reportType || reportType === '') {
      validationReportType = 'is-invalid';
    } else {
      validationReportType = 'is-valid';
    }

    // Validate the startTime
    if (!time || time === '') {
      validationTime = 'is-invalid';
    } else {
      validationTime = 'is-valid';
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

    // Validate the actionTaken
    if (!actionTaken || actionTaken === '') {
      validationActionTaken = 'is-invalid';
    } else {
      validationActionTaken = 'is-valid';
    }

    // Validate the eventSummary
    if (!eventSummary || eventSummary === '') {
      validationEventSummary = 'is-invalid';
    } else {
      validationEventSummary = 'is-valid';
    }

    // Validate the eventSummary
    if (!staffOnDuty || staffOnDuty === '') {
      validationStaffOnDuty = 'is-invalid';
    } else {
      validationStaffOnDuty = 'is-valid';
    }

    if (
      validationReportType === 'is-valid' &&
      validationTime === 'is-valid' &&
      validationDate === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationActionTaken === 'is-valid' &&
      validationEventSummary === 'is-valid' &&
      validationStaffOnDuty === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      // Activity
      const newItemActivity = {
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Case Report',
        title: 'Submitted a case report of ' + _.lowerCase(reportType),
        about: eventSummary
      };

      const newActivity = new Activity({
        date: currentDate,
        items: newItemActivity
      });

      const findDate = await Activity.findOne({ date: currentDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity was added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }

      const currentSummary = eventSummary + '\n\n' + actionTaken;

      const newReport = new CaseReport({
        reportId: confirmRid,
        username: currentUser,
        madeBy: currentFullName,
        type: reportType,
        time: time,
        date: date,
        summary: currentSummary,
        actionTaken: actionTaken,
        eventSummary: eventSummary,
        staffOnDuty: staffOnDuty,
        location: location,
        notes: ''
      });

      const existing = await CaseReport.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = CaseReport.create(newReport);

        if (result) {
          console.log('Successfully added report.');

          const checkUser = await User.findOne({
            username: currentUsername
          });

          if (checkUser) {
            const itemReports = await CaseReport.find({
              username: checkUser.username
            }).sort({ date: -1 });
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemCM = await CaseReport.find({
              location: 'City Mosque',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah',
              username: checkUser.username
            }).sort({ date: -1 });

            if (itemReports.length > 0) {
              res.render('case-report-view', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemReports: itemReports,
                totalReports: itemReports.length,
                amountBMI: itemBMI.length,
                amountBMII: itemBMII.length,
                amountJM: itemJM.length,
                amountCM: itemCM.length,
                amountRS: itemRS.length,
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated random id
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Submit report successful!',
                //role
                role: checkUser.role
              });
            } else {
              res.render('case-report-view', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemReports: 'There is no case report submitted yet.',
                totalReports: '0',
                amountBMI: '0',
                amountBMII: '0',
                amountJM: '0',
                amountCM: '0',
                amountRS: '0',
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated random id
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Submit report successful!',
                //role
                role: checkUser.role
              });
            }
          }
        } else {
          console.log('Add report failed');

          const checkUser = await User.findOne({
            username: currentUsername
          });

          if (checkUser) {
            const itemReports = await CaseReport.find({
              username: checkUser.username
            }).sort({ date: -1 });
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque',
              username: checkUser.username
            }).sort({ date: -1 });
            const itemCM = await CaseReport.find({
              location: 'City Mosque',
              username: checkUser.username
            });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah',
              username: checkUser.username
            }).sort({ date: -1 });

            if (itemReports.length > 0) {
              res.render('case-report-view', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemReports: itemReports,
                totalReports: itemReports.length,
                amountBMI: itemBMI.length,
                amountBMII: itemBMII.length,
                amountJM: itemJM.length,
                amountCM: itemCM.length,
                amountRS: itemRS.length,
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated random id
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Add report failed!',
                //role
                role: checkUser.role
              });
            } else {
              res.render('case-report-view', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemReports: 'There is no case report submitted yet.',
                totalReports: '0',
                amountBMI: '0',
                amountBMII: '0',
                amountJM: '0',
                amountCM: '0',
                amountRS: '0',
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated random id
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Add report failed!',
                //role
                role: checkUser.role
              });
            }
          }
        }
      } else {
        console.log('There is existing report!');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          const itemReports = await CaseReport.find({}).sort({
            date: -1
          });
          const itemBMI = await CaseReport.find({
            location: 'Baitul Makmur I',
            username: checkUser.username
          }).sort({ date: -1 });
          const itemBMII = await CaseReport.find({
            location: 'Baitul Makmur II',
            username: checkUser.username
          }).sort({ date: -1 });
          const itemJM = await CaseReport.find({
            location: 'Jamek Mosque',
            username: checkUser.username
          }).sort({ date: -1 });
          const itemCM = await CaseReport.find({
            location: 'City Mosque'
          }).sort({ date: -1 });
          const itemRS = await CaseReport.find({
            location: 'Raudhatul Sakinah',
            username: checkUser.username
          }).sort({ date: -1 });

          if (itemReports.length > 0) {
            res.render('case-report-view', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              itemReports: itemReports,
              totalReports: itemReports.length,
              amountBMI: itemBMI.length,
              amountBMII: itemBMII.length,
              amountJM: itemJM.length,
              amountCM: itemCM.length,
              amountRS: itemRS.length,
              topNav: 'All',
              classActive1: 'active',
              classActive2: '',
              classActive3: '',
              classActive4: '',
              classActive5: '',
              classActive6: '',
              // generated random id
              rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
              // toast alert
              toastShow: 'show',
              toastMsg: 'There is an exisitng report!',
              //role
              role: checkUser.role
            });
          } else {
            res.render('case-report-view', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              itemReports: 'There is no case report submitted yet.',
              totalReports: '0',
              amountBMI: '0',
              amountBMII: '0',
              amountJM: '0',
              amountCM: '0',
              amountRS: '0',
              topNav: 'All',
              classActive1: 'active',
              classActive2: '',
              classActive3: '',
              classActive4: '',
              classActive5: '',
              classActive6: '',
              // generated random id
              rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
              // toast alert
              toastShow: 'show',
              toastMsg: 'There is an existing report!',
              //role
              role: checkUser.role
            });
          }
        }
      }
    } else {
      // Render the response after the delay
      res.render('case-report-submit', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        //validation
        validationReportType: validationReportType,
        validationDate: validationDate,
        validationTime: validationTime,
        validationLocation: validationLocation,
        validationReportSummary: validationReportSummary,
        validationEventSummary: validationEventSummary,
        validationActionTaken: validationActionTaken,
        validationStaffOnDuty: validationStaffOnDuty,
        //form
        reportId: confirmRid,
        reportType: reportType,
        time: time,
        date: date,
        location: location,
        reportSummary: reportSummary,
        eventSummary: eventSummary,
        actionTaken: actionTaken,
        staffOnDuty: staffOnDuty,
        //toast alert
        toastShow: 'show',
        toastMsg: 'There is error in your input!',
        //role
        role: checkUser.role
      });
    }
  });

// DETAILS
app.get('/case-report/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const reportId = req.query.id;

    if (checkUser) {
      const checkReport = await CaseReport.findOne({
        reportId: reportId
      });

      if (checkReport) {
        const checkFiles = await File.find({ reportId: reportId });

        if (checkFiles.length > 0) {
          res.render('case-report-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            reportType: checkReport.type,
            madeBy: checkReport.madeBy,
            pbNumber: checkReport.username,
            time: checkReport.time,
            date: checkReport.date,
            reportSummary: checkReport.summary,
            actionTaken: checkReport.actionTaken,
            eventSummary: checkReport.eventSummary,
            staffOnDuty: checkReport.staffOnDuty,
            notes: checkReport.notes,
            reportId: checkReport.reportId,
            // files
            files: checkFiles,
            //role
            role: checkUser.role
          });
        } else {
          res.render('case-report-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            reportType: checkReport.type,
            madeBy: checkReport.madeBy,
            pbNumber: checkReport.username,
            time: checkReport.time,
            date: checkReport.date,
            reportSummary: checkReport.summary,
            actionTaken: checkReport.actionTaken,
            eventSummary: checkReport.eventSummary,
            staffOnDuty: checkReport.staffOnDuty,
            notes: checkReport.notes,
            reportId: checkReport.reportId,
            // files
            files: checkFiles,
            //role
            role: checkUser.role
          });
        }
      } else {
        res.render('case-report-details', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: '',
          reportType: '',
          madeBy: '',
          pbNumber: '',
          time: '',
          date: '',
          reportSummary: '',
          actionTaken: '',
          eventSummary: '',
          staffOnDuty: '',
          files: '',
          notes: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SCHEDULE

// SCHEDULE SCHEMA/MODEL
const scheduleSchema = new mongoose.Schema({
  reportId: String,
  by: String,
  location: String,
  scheduleTitle: String,
  month: String,
  startDate: String,
  endDate: String,
  status: String,
  notes: String
});

const Schedule = mongoose.model('Schedule', scheduleSchema);

// FILES SCHEDULE SCHEMA/MODEL
const fileScheduleSchema = new mongoose.Schema({
  reportId: String,
  by: String,
  filename: String,
  path: String,
  date: String,
  fileType: String
});

const FileSchedule = mongoose.model('FileSchedule', fileScheduleSchema);

// UPLOAD FILE SCHEDULE
app.post('/upload-schedule', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('There is no files selected');
  } else {
    // find user full name
    const currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    // find current confirm report id
    const confirmRid = req.body.fileReportId;

    // date for upload
    var uploadDate = dateLocal.getDateYear();
    var uploadTime = getKualaLumpurTime();

    // Activity
    const newItemActivity = {
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in schedule'
    };

    const newActivity = new Activity({
      date: uploadDate,
      items: newItemActivity
    });

    // Check if the report ID exists in the database
    const existingFile = await FileSchedule.findOne({
      reportId: confirmRid
    });

    if (!existingFile) {
      const findDate = await Activity.findOne({ date: uploadDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }

      // No file with the report ID found, proceed with file upload
      for (const file of Object.values(req.files)) {
        const uploadPath = __dirname + '/public/uploads/' + file.name;
        const pathFile = 'uploads/' + file.name;
        const todayDate = dateLocal.getDate();
        const fileType = path.extname(file.name);

        file.mv(uploadPath, err => {
          if (err) {
            console.log(err);
          }

          // Save file information to the MongoDB
          const newFile = new FileSchedule({
            reportId: confirmRid,
            by: checkUser.fullname,
            filename: file.name,
            path: pathFile,
            date: todayDate,
            fileType: fileType
          });

          newFile.save();
        });
      }
      res.redirect('/schedule');
    } else {
      // File with the report ID already exists
      res.redirect('/schedule');
    }
  }
});

// SUBMIT FORM
app
  .get('/schedule/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      var currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      const confirmRid = req.query.rid;

      if (checkUser) {
        res.render('schedule-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: confirmRid,
          //validation
          validationScheduleTitle: '',
          validationStartDate: '',
          validationEndDate: '',
          validationMonth: '',
          validationLocation: '',
          validationStatus: '',
          validationNotes: '',
          //form name
          scheduleTitle: '',
          startDate: '',
          endDate: '',
          month: '',
          location: '',
          status: '',
          notes: '',
          //toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/schedule/submit', async function (req, res) {
    var validationScheduleTitle = '';
    var validationStartDate = '';
    var validationEndDate = '';
    var validationMonth = '';
    var validationLocation = '';
    var validationStatus = '';
    var validationNotes = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const scheduleTitle = req.body.scheduleTitle;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const location = req.body.location;
    const month = req.body.month;
    const status = req.body.status;
    const notes = req.body.notes;

    const currentUsername = req.session.user.username;
    const confirmRid = req.body.confirmRid;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the scheduleTitle
    if (!scheduleTitle || scheduleTitle === '') {
      validationScheduleTitle = 'is-invalid';
    } else {
      validationScheduleTitle = 'is-valid';
    }

    // Validate the startDate
    if (!startDate || startDate === '') {
      validationStartDate = 'is-invalid';
    } else {
      validationStartDate = 'is-valid';
    }

    // Validate the endDate
    if (!endDate || endDate === '') {
      validationEndDate = 'is-invalid';
    } else {
      validationEndDate = 'is-valid';
    }

    // Validate the month
    if (!month || month === '') {
      validationMonth = 'is-invalid';
    } else {
      validationMonth = 'is-valid';
    }

    // Validate the location
    if (!location || location === '') {
      validationLocation = 'is-invalid';
    } else {
      validationLocation = 'is-valid';
    }

    // Validate the status
    if (!status || status === '') {
      validationStatus = 'is-invalid';
    } else {
      validationStatus = 'is-valid';
    }

    // Validate the notes
    if (!notes || notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    if (
      validationScheduleTitle === 'is-valid' &&
      validationStartDate === 'is-valid' &&
      validationEndDate === 'is-valid' &&
      validationMonth === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationStatus === 'is-valid' &&
      validationNotes === 'is-valid'
    ) {
      const currentUser = checkUser.username;

      // Activity
      const newItemActivity = {
        time: currentTime,
        by: checkUser.fullname,
        username: currentUser,
        type: 'Schedule',
        title:
          'Submitted a schedule of ' +
          month +
          ' ,from ' +
          startDate +
          ' towards ' +
          endDate,
        about: notes + ' ,while currently the status is ' + status
      };

      const newActivity = new Activity({
        date: currentDate,
        items: newItemActivity
      });

      const findDate = await Activity.findOne({ date: currentDate });

      if (findDate) {
        findDate.items.push(newItemActivity);
        await findDate.save();
        console.log('Activity was added to existing date');
      } else {
        const resultActivity = Activity.create(newActivity);

        if (resultActivity) {
          console.log('Added new activity');
        } else {
          console.log('Something is wrong');
        }
      }

      const newSchedule = new Schedule({
        reportId: confirmRid,
        by: currentUser,
        location: location,
        scheduleTitle: scheduleTitle,
        month: month,
        startDate: startDate,
        endDate: endDate,
        status: status,
        notes: notes
      });

      const existing = await Schedule.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = Schedule.create(newSchedule);

        if (result) {
          // sucessfully added report
          console.log('Successfully added report!');

          const checkUser = await User.findOne({
            username: currentUsername
          });

          if (checkUser) {
            // schedules
            const itemSchedules = await Schedule.find({}).sort({
              startDate: -1
            });
            const itemBMI = await Schedule.find({
              location: 'Baitul Makmur I'
            }).sort({ startDate: -1 });
            const itemBMII = await Schedule.find({
              location: 'Baitul Makmur II'
            }).sort({ startDate: -1 });
            const itemJM = await Schedule.find({
              location: 'Jamek Mosque'
            }).sort({ startDate: -1 });
            const itemCM = await Schedule.find({
              location: 'City Mosque'
            }).sort({ startDate: -1 });
            const itemRS = await Schedule.find({
              location: 'Raudhatul Sakinah'
            }).sort({ startDate: -1 });

            // schedules file
            const itemFiles = await FileSchedule.find({});

            if (itemSchedules.length > 0) {
              res.render('schedule', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemFiles: itemFiles,
                itemSchedules: itemSchedules,
                totalSchedules: itemSchedules.length,
                amountBMI: itemBMI.length,
                amountBMII: itemBMII.length,
                amountJM: itemJM.length,
                amountCM: itemCM.length,
                amountRS: itemRS.length,
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated rid
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Submit schedule successful!',
                //role
                role: checkUser.role
              });
            } else {
              res.render('schedule', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemFiles: '',
                itemSchedules: '',
                totalSchedules: '0',
                amountBMI: '0',
                amountBMII: '0',
                amountJM: '0',
                amountCM: '0',
                amountRS: '0',
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated rid
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Submit schedule successful!',
                //role
                role: checkUser.role
              });
            }
          }
        } else {
          // failed added report
          console.log('Report add failed!');

          const checkUser = await User.findOne({
            username: currentUsername
          });

          if (checkUser) {
            // schedules
            const itemSchedules = await Schedule.find({}).sort({
              startDate: -1
            });
            const itemBMI = await Schedule.find({
              location: 'Baitul Makmur I'
            }).sort({ startDate: -1 });
            const itemBMII = await Schedule.find({
              location: 'Baitul Makmur II'
            }).sort({ startDate: -1 });
            const itemJM = await Schedule.find({
              location: 'Jamek Mosque'
            }).sort({ startDate: -1 });
            const itemCM = await Schedule.find({
              location: 'City Mosque'
            }).sort({ startDate: -1 });
            const itemRS = await Schedule.find({
              location: 'Raudhatul Sakinah'
            }).sort({ startDate: -1 });

            // schedules file
            const itemFiles = await FileSchedule.find({});

            if (itemSchedules.length > 0) {
              res.render('schedule', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemFiles: itemFiles,
                itemSchedules: itemSchedules,
                totalSchedules: itemSchedules.length,
                amountBMI: itemBMI.length,
                amountBMII: itemBMII.length,
                amountJM: itemJM.length,
                amountCM: itemCM.length,
                amountRS: itemRS.length,
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated rid
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Add schedule failed!',
                //role
                role: checkUser.role
              });
            } else {
              res.render('schedule', {
                currentFullName: checkUser.fullname,
                currentUser: checkUser.username,
                currentProfile: checkUser.profile,
                itemFiles: '',
                itemSchedules: '',
                totalSchedules: '0',
                amountBMI: '0',
                amountBMII: '0',
                amountJM: '0',
                amountCM: '0',
                amountRS: '0',
                topNav: 'All',
                classActive1: 'active',
                classActive2: '',
                classActive3: '',
                classActive4: '',
                classActive5: '',
                classActive6: '',
                // generated rid
                rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
                // toast alert
                toastShow: 'show',
                toastMsg: 'Add schedule failed!',
                //role
                role: checkUser.role
              });
            }
          }
        }
      } else {
        console.log('There is existing schedule.');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          // schedules
          const itemSchedules = await Schedule.find({}).sort({
            startDate: -1
          });
          const itemBMI = await Schedule.find({
            location: 'Baitul Makmur I'
          }).sort({ startDate: -1 });
          const itemBMII = await Schedule.find({
            location: 'Baitul Makmur II'
          }).sort({ startDate: -1 });
          const itemJM = await Schedule.find({
            location: 'Jamek Mosque'
          }).sort({ startDate: -1 });
          const itemCM = await Schedule.find({
            location: 'City Mosque'
          }).sort({
            startDate: -1
          });
          const itemRS = await Schedule.find({
            location: 'Raudhatul Sakinah'
          }).sort({ startDate: -1 });

          // schedules file
          const itemFiles = await FileSchedule.find({});

          if (itemSchedules.length > 0) {
            res.render('schedule', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              itemFiles: itemFiles,
              itemSchedules: itemSchedules,
              totalSchedules: itemSchedules.length,
              amountBMI: itemBMI.length,
              amountBMII: itemBMII.length,
              amountJM: itemJM.length,
              amountCM: itemCM.length,
              amountRS: itemRS.length,
              topNav: 'All',
              classActive1: 'active',
              classActive2: '',
              classActive3: '',
              classActive4: '',
              classActive5: '',
              classActive6: '',
              // generated rid
              rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
              // toast alert
              toastShow: 'show',
              toastMsg: 'There is existing schedule!',
              //role
              role: checkUser.role
            });
          } else {
            res.render('schedule', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              itemFiles: '',
              itemSchedules: '',
              totalSchedules: '0',
              amountBMI: '0',
              amountBMII: '0',
              amountJM: '0',
              amountCM: '0',
              amountRS: '0',
              topNav: 'All',
              classActive1: 'active',
              classActive2: '',
              classActive3: '',
              classActive4: '',
              classActive5: '',
              classActive6: '',
              // generated rid
              rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
              // toast alert
              toastShow: 'show',
              toastMsg: 'There is existing schedule!',
              //role
              role: checkUser.role
            });
          }
        }
      }
    } else {
      res.render('schedule-submit', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        reportId: confirmRid,
        //validation
        validationScheduleTitle: validationScheduleTitle,
        validationStartDate: validationStartDate,
        validationEndDate: validationEndDate,
        validationMonth: validationMonth,
        validationLocation: validationLocation,
        validationStatus: validationStatus,
        validationNotes: validationNotes,
        //form name
        reportId: confirmRid,
        scheduleTitle: scheduleTitle,
        startDate: startDate,
        endDate: endDate,
        month: month,
        location: location,
        status: status,
        notes: notes,
        //toast alert
        toastShow: 'show',
        toastMsg: 'There is error in your input!',
        //role
        role: checkUser.role
      });
    }
  });

// VIEW
app.get('/schedule', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({}).sort({
        startDate: -1
      });
      const itemBMI = await Schedule.find({
        location: 'Baitul Makmur I'
      }).sort({ startDate: -1 });
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      }).sort({ startDate: -1 });
      const itemJM = await Schedule.find({
        location: 'Jamek Mosque'
      }).sort({
        startDate: -1
      });
      const itemCM = await Schedule.find({ location: 'City Mosque' });
      const itemRS = await Schedule.find({
        location: 'Raudhatul Sakinah'
      }).sort({ startDate: -1 });

      // schedules file
      const itemFiles = await FileSchedule.find({});

      if (itemSchedules.length > 0) {
        res.render('schedule', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemFiles: itemFiles,
          itemSchedules: itemSchedules,
          totalSchedules: itemSchedules.length,
          amountBMI: itemBMI.length,
          amountBMII: itemBMII.length,
          amountJM: itemJM.length,
          amountCM: itemCM.length,
          amountRS: itemRS.length,
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated rid
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      } else {
        res.render('schedule', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemFiles: '',
          itemSchedules: '',
          totalSchedules: '0',
          amountBMI: '0',
          amountBMII: '0',
          amountJM: '0',
          amountCM: '0',
          amountRS: '0',
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated rid
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// VIEW CUSTOM NAME LIST BASED ON LOCATION
app.get('/schedule/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({}).sort({
        startDate: -1
      });
      const itemBMI = await Schedule.find({
        location: 'Baitul Makmur I'
      }).sort({ startDate: -1 });
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      }).sort({ startDate: -1 });
      const itemJM = await Schedule.find({
        location: 'Jamek Mosque'
      }).sort({
        startDate: -1
      });
      const itemCM = await Schedule.find({
        location: 'City Mosque'
      }).sort({
        startDate: -1
      });
      const itemRS = await Schedule.find({
        location: 'Raudhatul Sakinah'
      }).sort({ startDate: -1 });

      // schedules file
      const itemFiles = await FileSchedule.find({});

      // check customlistname
      if (customListName === 'BMI') {
        // view for baitul makmur 1
        if (itemSchedules.length > 0) {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: itemFiles,
            itemSchedules: itemBMI,
            totalSchedules: itemSchedules.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: '',
            itemSchedules: '',
            totalSchedules: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'BMII') {
        // view for baitul makmur 2
        if (itemSchedules.length > 0) {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: itemFiles,
            itemSchedules: itemBMII,
            totalSchedules: itemSchedules.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: '',
            itemSchedules: '',
            totalSchedules: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'JM') {
        // view for jamek mosque
        if (itemSchedules.length > 0) {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: itemFiles,
            itemSchedules: itemJM,
            totalSchedules: itemSchedules.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: '',
            itemSchedules: '',
            totalSchedules: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'CM') {
        // view for city mosque
        if (itemSchedules.length > 0) {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: itemFiles,
            itemSchedules: itemCM,
            totalSchedules: itemSchedules.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: '',
            itemSchedules: '',
            totalSchedules: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'RS') {
        // view for city mosque
        if (itemSchedules.length > 0) {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: itemFiles,
            itemSchedules: itemRS,
            totalSchedules: itemSchedules.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('schedule', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemFiles: '',
            itemSchedules: '',
            totalSchedules: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated rid
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.redirect('/home');
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// PROFILE

// SHOW PROFILE
app.get('/social/profile/', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const checkCaseReport = await CaseReport.find({
        username: checkUser.username
      });
      const checkPatrolReport = await PatrolReport.find({
        staff: checkUser.fullname
      });

      const checkActivity = await Activity.find({
        'items.username': currentUsername
      })
        .limit(7)
        .sort({ date: -1 });

      var todayDate = dateLocal.getDateYear();

      if (checkActivity.length > 0) {
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: checkActivity,
          todayDate: todayDate,
          //role
          role: checkUser.role
        });
      } else {
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: '',
          todayDate: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SHOW PROFILE WITH FULL NAME
app.get('/social/profile/:fullName', async function (req, res) {
  if (req.isAuthenticated()) {
    var fullName = req.params.fullName;
    var currentUsername = '';

    // find username using fullname
    const checkUsername = await User.findOne({ fullname: fullName });

    if (!checkUsername && _.isEmpty(fullName)) {
      currentUsername = req.session.user.username;
    } else {
      currentUsername = checkUsername.username;
    }

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const checkCaseReport = await CaseReport.find({
        username: checkUser.username
      });
      const checkPatrolReport = await PatrolReport.find({
        staff: checkUser.fullname
      });

      const checkActivity = await Activity.find({
        'items.username': currentUsername
      })
        .limit(7)
        .sort({ date: -1 });

      var todayDate = dateLocal.getDateYear();

      if (checkActivity.length > 0) {
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: checkActivity,
          todayDate: todayDate,
          //role
          role: checkUser.role
        });
      } else {
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: '',
          todayDate: '',
          //role
          role: checkUser.role
        });
      }
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
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        currentEmail: checkUser.email,
        currentPhone: checkUser.phone,
        // validation
        validationFullName: '',
        validationEmail: '',
        validationPhone: '',
        validationOldPassword: '',
        validationNewPassword: '',
        validationConfirmPassword: '',
        // input
        fullName: '',
        email: '',
        phone: '',
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
        toastShow: '',
        toastMsg: '',
        //role
        role: checkUser.role
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SUBMIT SETTINGS
app.post('/social/settings/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // request customName
    const customListName = req.params.customListName;

    if (checkUser) {
      if (customListName === 'submit-information') {
        const fullName = req.body.fullname;
        const email = req.body.email;
        const phone = req.body.phone;

        const fullNameRegex = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneNumberRegex = /^(\+?6?01)[0-9]-*\d{7,8}$/;

        var validationFullName = '';
        var validationEmail = '';
        var validationPhone = '';

        // Full Name
        if (fullNameRegex.test(fullName) === 'false' || fullName === '') {
          validationFullName = 'is-invalid';
        } else {
          validationFullName = 'is-valid';
        }

        // Email
        if (emailRegex.test(email) === 'false' || email === '') {
          validationEmail = 'is-invalid';
        } else {
          validationEmail = 'is-valid';
        }

        // Phone
        if (phoneNumberRegex.test(phone) === 'false' || phone === '') {
          validationPhone = 'is-invalid';
        } else {
          validationPhone = 'is-valid';
        }

        if (
          validationFullName === 'is-valid' &&
          validationEmail === 'is-valid' &&
          validationPhone === 'is-valid'
        ) {
          const filter = { username: currentUsername };

          const update = {
            $set: {
              fullname: fullName,
              email: email,
              phone: phone
            }
          };

          const options = { new: true };

          const updatedUser = await User.findOneAndUpdate(
            filter,
            update,
            options
          );

          if (updatedUser) {
            console.log('Successful update user data');
            res.render('settings', {
              currentFullName: fullName,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              currentEmail: email,
              currentPhone: phone,
              // validation
              validationFullName: '',
              validationEmail: '',
              validationPhone: '',
              validationOldPassword: '',
              validationNewPassword: '',
              validationConfirmPassword: '',
              // input
              fullName: '',
              email: '',
              phone: '',
              oldPassword: '',
              newPassword: '',
              confirmPassword: '',
              toastShow: 'show',
              toastMsg: 'Update information succesful',
              //role
              role: checkUser.role
            });
          } else {
            console.log('Unsuccessful update user data');
            res.render('settings', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              currentEmail: checkUser.email,
              currentPhone: checkUser.phone,
              // validation
              validationFullName: '',
              validationEmail: '',
              validationPhone: '',
              validationOldPassword: '',
              validationNewPassword: '',
              validationConfirmPassword: '',
              // input
              fullName: '',
              email: '',
              phone: '',
              oldPassword: '',
              newPassword: '',
              confirmPassword: '',
              toastShow: 'show',
              toastMsg: 'Update information error',
              //role
              role: checkUser.role
            });
          }
        } else {
          res.render('settings', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            currentEmail: checkUser.email,
            currentPhone: checkUser.phone,
            // validation
            validationFullName: validationFullName,
            validationEmail: validationEmail,
            validationPhone: validationPhone,
            validationOldPassword: '',
            validationNewPassword: '',
            validationConfirmPassword: '',
            // input
            fullName: fullName,
            email: email,
            phone: phone,
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
            toastShow: 'show',
            toastMsg: 'There is error in information input',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'submit-password') {
        const oldPassword = req.body.oldPassword;
        const newPassword = req.body.newPassword;
        const confirmPassword = req.body.confirmPassword;

        const passwordRegex = /^(?:\d+|[a-zA-Z0-9]{4,})/;

        var validationOldPassword = '';
        var validationNewPassword = '';
        var validationConfirmPassword = '';

        const user = await User.findByUsername(currentUsername);

        var checkOldPassword = '';

        user.authenticate(oldPassword, function (err, result) {
          if (result) {
            checkOldPassword = 'correct';
          } else {
            checkOldPassword = 'incorrect';
          }
          console.log(checkOldPassword);

          // Old Password
          if (
            passwordRegex.test(oldPassword) === 'false' ||
            oldPassword === '' ||
            checkOldPassword === 'incorrect'
          ) {
            validationOldPassword = 'is-invalid';
          } else {
            validationOldPassword = 'is-valid';
          }

          // New Password
          if (
            passwordRegex.test(newPassword) === 'false' ||
            newPassword === ''
          ) {
            validationNewPassword = 'is-invalid';
          } else {
            validationNewPassword = 'is-valid';
          }

          // Phone
          if (newPassword !== confirmPassword) {
            validationConfirmPassword = 'is-invalid';
          } else {
            validationConfirmPassword = 'is-valid';
          }

          if (
            validationOldPassword === 'is-valid' &&
            validationNewPassword === 'is-valid' &&
            validationConfirmPassword === 'is-valid'
          ) {
            user.changePassword(oldPassword, newPassword, err => {
              if (err) {
                console.error(err);
              } else {
                console.log('Successfully change password');
                res.render('settings', {
                  currentFullName: checkUser.fullname,
                  currentUser: checkUser.username,
                  currentProfile: checkUser.profile,
                  currentEmail: checkUser.email,
                  currentPhone: checkUser.phone,
                  // validation
                  validationFullName: '',
                  validationEmail: '',
                  validationPhone: '',
                  validationOldPassword: '',
                  validationNewPassword: '',
                  validationConfirmPassword: '',
                  // input
                  fullName: '',
                  email: '',
                  phone: '',
                  oldPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                  toastShow: 'show',
                  toastMsg: 'Change password successful',
                  //role
                  role: checkUser.role
                });
              }
            });
          } else {
            console.log('Unsuccessful');
            res.render('settings', {
              currentFullName: checkUser.fullname,
              currentUser: checkUser.username,
              currentProfile: checkUser.profile,
              currentEmail: checkUser.email,
              currentPhone: checkUser.phone,
              // validation
              validationFullName: '',
              validationEmail: '',
              validationPhone: '',
              validationOldPassword: validationOldPassword,
              validationNewPassword: validationNewPassword,
              validationConfirmPassword: validationConfirmPassword,
              // input
              fullName: '',
              email: '',
              phone: '',
              oldPassword: oldPassword,
              newPassword: newPassword,
              confirmPassword: confirmPassword,
              toastShow: 'show',
              toastMsg: 'There is error in password input',
              //role
              role: checkUser.role
            });
          }
        });
      } else if (customListName === 'upload-profile') {
        if (!req.files || Object.keys(req.files).length === 0) {
          console.log('There is no files selected');
        } else {
          // find user full name
          const currentUsername = req.session.user.username;
          const checkUser = await User.findOne({
            username: currentUsername
          });

          // date for upload
          var uploadDate = dateLocal.getDateYear();
          var uploadTime = getKualaLumpurTime();

          // Activity
          const newItemActivity = {
            time: uploadTime,
            by: checkUser.fullname,
            username: checkUser.username,
            type: 'Upload Profile',
            title: 'Update & uploaded profiles',
            about: 'Image added for profile image displayed'
          };

          const newActivity = new Activity({
            date: uploadDate,
            items: newItemActivity
          });

          const findDate = await Activity.findOne({
            date: uploadDate
          });

          if (findDate) {
            findDate.items.push(newItemActivity);
            await findDate.save();
            console.log('Activity was added to existing date');
          } else {
            const resultActivity = Activity.create(newActivity);

            if (resultActivity) {
              console.log('Added new activity');
            } else {
              console.log('Something is wrong');
            }
          }
          // No file with the report ID found, proceed with file upload
          for (const file of Object.values(req.files)) {
            const uploadPath = __dirname + '/public/uploads/' + file.name;
            const filepath = '/uploads/' + file.name;

            file.mv(uploadPath, err => {
              if (err) {
                console.log(err);
              }
            });

            const updatedProfile = await User.findOneAndUpdate(
              { username: checkUser.username },
              { $set: { profile: filepath } },
              { new: true }
            );

            if (updatedProfile) {
              console.log('Profile image updated');
              res.redirect('/social/settings');
            } else {
              console.log('Profile image cannot be updated');
              res.redirect('/social/settings');
            }
          }
        }
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// DUTY HANDOVER

const give = {
  headShift: String,
  handoverShift: String,
  staffAbsent: String,
  logReport: String,
  shift: String,
  shiftMember: [String]
};

const receive = {
  headShift: String,
  handoverShift: String,
  staffAbsent: String,
  logReport: String,
  shift: String,
  time: String,
  shiftMember: [String]
};

const dutyHandoverSchema = new mongoose.Schema({
  reportId: String,
  handled: String,
  date: String,
  startShift: String,
  endShift: String,
  location: String,
  notes: String,
  status: String,
  give: give,
  receive: receive
});

const DutyHandover = mongoose.model('DutyHandover', dutyHandoverSchema);

// VIEW
app.get('/duty-handover/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await DutyHandover.find({}).sort({ date: -1 });
      console.log(itemReports.give);
      const itemBMI = await DutyHandover.find({
        location: 'Baitul Makmur I'
      }).sort({ date: -1 });
      const itemBMII = await DutyHandover.find({
        location: 'Baitul Makmur II'
      }).sort({ date: -1 });
      const itemJM = await DutyHandover.find({
        location: 'Jamek Mosque'
      }).sort({ date: -1 });
      const itemCM = await DutyHandover.find({
        location: 'City Mosque'
      }).sort({
        date: -1
      });
      const itemRS = await DutyHandover.find({
        location: 'Raudhatul Sakinah'
      }).sort({ date: -1 });

      if (itemReports.length > 0) {
        res.render('duty-handover-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: itemReports,
          totalReports: itemReports.length,
          amountBMI: itemBMI.length,
          amountBMII: itemBMII.length,
          amountJM: itemJM.length,
          amountCM: itemCM.length,
          amountRS: itemRS.length,
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      } else {
        res.render('duty-handover-view', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          itemReports: 'There is no case report submitted yet.',
          totalReports: '0',
          amountBMI: '0',
          amountBMII: '0',
          amountJM: '0',
          amountCM: '0',
          amountRS: '0',
          topNav: 'All',
          classActive1: 'active',
          classActive2: '',
          classActive3: '',
          classActive4: '',
          classActive5: '',
          classActive6: '',
          // generated random id
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          // toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// VIEW CUSTOM NAME LIST BASE ON LOCATIONS
app.get('/duty-handover/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await DutyHandover.find({}).sort({ date: -1 });
      const itemBMI = await DutyHandover.find({
        location: 'Baitul Makmur I'
      }).sort({ date: -1 });
      const itemBMII = await DutyHandover.find({
        location: 'Baitul Makmur II'
      }).sort({ date: -1 });
      const itemJM = await DutyHandover.find({
        location: 'Jamek Mosque'
      }).sort({ date: -1 });
      const itemCM = await DutyHandover.find({
        location: 'City Mosque'
      }).sort({
        date: -1
      });
      const itemRS = await DutyHandover.find({
        location: 'Raudhatul Sakinah'
      }).sort({ date: -1 });

      // check customlistname
      if (customListName === 'BMI') {
        // view for baitul makmur 1
        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMI,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur I',
            classActive1: '',
            classActive2: 'active',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'BMII') {
        // view for baitul makmur 2
        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemBMII,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Baitul Makmur II',
            classActive1: '',
            classActive2: '',
            classActive3: 'active',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'JM') {
        // view for jamek mosque
        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemJM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Jamek Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: 'active',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'CM') {
        // view for city mosque
        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemCM,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'City Mosque',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: 'active',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else if (customListName === 'RS') {
        // view for raudhatul sakinah
        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemRS,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'Raudhatul Sakinah',
            classActive1: '',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: 'active',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role
          });
        }
      } else {
        res.redirect('/home');
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SUBMIT
app
  .get('/duty-handover/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      const currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      const confirmRid = req.query.rid;

      if (checkUser) {
        res.render('duty-handover-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: confirmRid,
          //validation
          validationShift: '',
          validationLocation: '',
          validationHeadShift: '',
          validationStaffOnDuty: '',
          validationStaffSickLeave: '',
          validationStaffAbsent: '',
          validationNotes: '',
          validationSelectedNames: '',
          //form name
          shift: '',
          date: '',
          location: '',
          headShift: '',
          staffOnDuty: '',
          staffSickLeave: '',
          staffAbsent: '',
          notes: '',
          handoverShift: '',
          selectedNames: '',
          //toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/duty-handover/submit', async function (req, res) {
    var validationShift = '';
    var validationLocation = '';
    var validationHeadShift = '';
    var validationNotes = '';
    var validationStaffAbsent = '';
    var validationSelectedNames = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const formData = req.body;

    const shift = req.body.shift;
    const headShift = req.body.headShift;
    const notes = req.body.notes;
    const staffAbsent = req.body.staffAbsent;
    const confirmRid = req.body.confirmRid;
    const selectedNames = req.body.selectedNames
      ? req.body.selectedNames.split(',')
      : [];

    const currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the reportType
    if (!shift || shift === '' || shift === 'Choose a shift') {
      validationShift = 'is-invalid';
    } else {
      validationShift = 'is-valid';
    }

    // Validate the headShift
    if (!headShift || headShift === '') {
      validationHeadShift = 'is-invalid';
    } else {
      validationHeadShift = 'is-valid';
    }

    // Validate the notes
    if (!notes || notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    // Validate the staffAbsent
    if (!staffAbsent || staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    // Validate the selectedNames
    if (selectedNames.length === 0) {
      validationSelectedNames = 'is-invalid';
    } else {
      validationSelectedNames = 'is-valid';
    }

    if (
      validationShift === 'is-valid' &&
      validationHeadShift === 'is-valid' &&
      validationNotes === 'is-valid' &&
      validationStaffAbsent === 'is-valid' &&
      validationSelectedNames === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      // set location based on the head shift location
      var location = '';
      if (currentFullName === 'Head Shift BMI') {
        location = 'Baitul Makmur I';
      } else if (currentFullName === 'Head Shift BMII') {
        location = 'Baitul Makmur II';
      } else if (currentFullName === 'Head Shift JM') {
        location = 'Jamek Mosque';
      } else if (currentFullName === 'Head Shift CM') {
        location = 'City Mosque';
      } else if (currentFullName === 'Head Shift RS') {
        location = 'Raudhatul Sakinah';
      }

      const status = 'Incompleted';
      var handoverShift = '';

      // determine which shift to be handover
      if (shift === 'Shift A') {
        handoverShift = 'Shift B';
      } else if (shift === 'Shift B') {
        handoverShift = 'Shift C';
      } else if (shift === 'Shift C') {
        handoverShift = 'Shift A';
      }

      const giveLog =
        'Saya ' +
        headShift +
        ' selaku ketua syif ' +
        shift +
        ' telah menyerahkan tugas kepada selaku ketua syif, ' +
        handoverShift +
        ' dalam keadaan baik dan senarai peralatan tugas mencukupi di ' +
        location +
        ' pada tarikh ' +
        dateLocal.getDate();

      const kualaLumpurTimeZoneOffset1 = 8; // Kuala Lumpur is UTC+8
      const now1 = moment().utcOffset(kualaLumpurTimeZoneOffset1 * 60); // Convert hours to minutes

      // Get the current time in the Asia/Kuala_Lumpur timezone
      const currentTimeNumeric = now1.format('HHmm');

      // Function to choose start shift based on the current time
      function chooseStartShift(currentTime) {
        if (currentTime >= '0700' && currentTime < '1500') {
          return '0700';
        } else if (currentTime >= '1500' && currentTime < '2300') {
          return '1500';
        } else if (currentTime >= '2300' && currentTime < '0000') {
          return '2300';
        } else {
          return '2300';
        }
      }

      // Determine the start shift and corresponding end time
      const startTime = chooseStartShift(currentTimeNumeric);

      // Set the end time based on the chosen start shift
      let endTime = '';
      let cycleAmount = '';

      if (startTime === '0700') {
        endTime = '1500';
      } else if (startTime === '1500') {
        endTime = '2300';
      } else if (startTime === '2300') {
        endTime = '0700';
        cycleAmount = 8;
      }

      // Calculate cycleAmount based on the index
      function calculateCycleAmount(index) {
        return cycleAmount || 4; // Use cycleAmount if defined, otherwise default to 4
      }

      // check location
      var confirmLocation = [];

      const locationMappings = {
        'Baitul Makmur I': [
          { checkpointName: 'Parameter 1', time: '', logReport: '' },
          { checkpointName: 'Parameter 2', time: '', logReport: '' },
          { checkpointName: 'Parameter 3', time: '', logReport: '' },
          { checkpointName: 'Parameter 4', time: '', logReport: '' },
          { checkpointName: 'Basement 1', time: '', logReport: '' },
          { checkpointName: 'Basement 2', time: '', logReport: '' },
          { checkpointName: 'Basement 3', time: '', logReport: '' },
          { checkpointName: 'Basement 4', time: '', logReport: '' },
          { checkpointName: 'Club House', time: '', logReport: '' },
          { checkpointName: 'Old Cafe', time: '', logReport: '' },
          { checkpointName: 'Level 4', time: '', logReport: '' },
          { checkpointName: 'Level 8', time: '', logReport: '' }
        ],
        'Baitul Makmur II': [
          { checkpointName: 'Basement 1 (a)', time: '', logReport: '' },
          { checkpointName: 'Basement 1 (b)', time: '', logReport: '' },
          { checkpointName: 'Basement 1 (c)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (a)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (b)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (c)', time: '', logReport: '' },
          { checkpointName: 'Ground Floor 1', time: '', logReport: '' },
          { checkpointName: 'Ground Floor 2', time: '', logReport: '' },
          { checkpointName: 'Level 8', time: '', logReport: '' },
          { checkpointName: 'Level 17', time: '', logReport: '' },
          { checkpointName: 'Level 5 (a)', time: '', logReport: '' },
          { checkpointName: 'Level 5 (b)', time: '', logReport: '' },
          {
            checkpointName: 'Genset Outside Building',
            time: '',
            logReport: ''
          },
          { checkpointName: 'Emergency Entrance', time: '', logReport: '' },
          { checkpointName: 'Outside Cafe 1', time: '', logReport: '' },
          { checkpointName: 'Outside Cafe 2', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 6', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 10', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 11', time: '', logReport: '' }
        ],
        'Jamek Mosque': [
          { checkpointName: 'Bilal Area', time: '', logReport: '' },
          { checkpointName: 'Mosque Tower', time: '', logReport: '' },
          { checkpointName: 'Cooling Tower', time: '', logReport: '' },
          { checkpointName: 'Mimbar Area', time: '', logReport: '' },
          { checkpointName: 'First Gate', time: '', logReport: '' }
        ],
        'City Mosque': [
          { checkpointName: 'Main Entrance', time: '', logReport: '' },
          { checkpointName: 'Gate 2', time: '', logReport: '' },
          {
            checkpointName: 'Backside Mosque (cemetery)',
            time: '',
            logReport: ''
          },
          { checkpointName: 'Muslimah Pray Area', time: '', logReport: '' }
        ],
        'Raudhatul Sakinah': [
          { checkpointName: 'Cemetery Area 1', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 2', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 3', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 4', time: '', logReport: '' },
          { checkpointName: 'Office Area 1', time: '', logReport: '' },
          { checkpointName: 'Office Area 2', time: '', logReport: '' },
          { checkpointName: 'Office Area 3', time: '', logReport: '' }
        ]
      };

      if (locationMappings.hasOwnProperty(location)) {
        confirmLocation = locationMappings[location];
      }

      // Insert fullName into each checkpoint with a blank value
      confirmLocation.map(checkpoint => ({
        ...checkpoint,
        fullName: '' // Insert the fullName (may be blank)
      }));

      // Create an array of cycles with varying amounts based on the start time
      const cycles = [];

      const cycleAmounts = {
        '0700': 4,
        1500: 4,
        2300: 8
      };

      const timeSlotOffsets = {
        '0700': 0,
        1500: 0, // No offset for '1500'
        2300: 0 // No offset for '2200'
      };

      const timeSlotIncrements = {
        '0700': 200, // 2 hours for '0700'
        1500: 200, // 2 hours for '1500'
        2300: 100 // 1 hour for '2200'
      };

      const timeSlotStartOffset = timeSlotOffsets[startTime];
      const timeSlotIncrement = timeSlotIncrements[startTime];

      for (let i = 0; i < cycleAmounts[startTime]; i++) {
        const timeSlotStart =
          (parseInt(startTime, 10) +
            i * timeSlotIncrement +
            timeSlotStartOffset) %
          2400; // Ensure time is within 24-hour format
        const timeSlotEnd = (timeSlotStart + timeSlotIncrement) % 2400;

        const currentCycleAmount = calculateCycleAmount(i + 1);

        cycles.push({
          cycleSeq: i + 1, // Insert the cycleSeq
          cycleAmount: currentCycleAmount,
          timeSlot: `${timeSlotStart.toString().padStart(4, '0')}-${timeSlotEnd
            .toString()
            .padStart(4, '0')}`,
          checkpoint: confirmLocation.map(checkpoint => ({
            ...checkpoint,
            fullName: '' // Insert the fullName (may be blank)
          }))
        });
      }

      // patrol report register
      const newPatrolReport = new PatrolReport({
        reportId: confirmRid,
        type: 'Shift Member Location',
        shift: shift,
        startShift: startTime,
        endShift: endTime,
        date: dateLocal.getDate(),
        location: location,
        status: 'Open',
        staff: selectedNames,
        shiftMember: {
          cycle: cycles
        }
      });

      const giveHandover = {
        headShift: headShift,
        handoverShift: handoverShift,
        staffAbsent: staffAbsent,
        logReport: giveLog,
        shift: shift,
        shiftMember: selectedNames
      };

      const receiveHandover = {
        shift: handoverShift
      };

      const newHandover = new DutyHandover({
        reportId: confirmRid,
        handled: checkUser.fullname,
        date: dateLocal.getDate(),
        startShift: startTime,
        endShift: endTime,
        status: status,
        notes: notes,
        location: location,
        give: giveHandover,
        receive: receiveHandover
      });

      const existing = await DutyHandover.findOne({
        reportId: confirmRid
      });

      if (!existing) {
        // Activity
        const newItemActivity = {
          time: currentTime,
          by: currentFullName,
          username: currentUser,
          type: 'Duty Handover',
          title:
            'Submitted a duty handover report of ' +
            _.lowerCase(shift) +
            ' & status is ' +
            status,
          about: notes
        };

        const newActivity = new Activity({
          date: currentDate,
          items: newItemActivity
        });

        const findDate = await Activity.findOne({ date: currentDate });

        if (findDate) {
          findDate.items.push(newItemActivity);
          await findDate.save();
          console.log('Activity added to existing date');
        } else {
          const resultActivity = Activity.create(newActivity);

          if (resultActivity) {
            console.log('Added new activity');
          } else {
            console.log('Something is wrong');
          }
        }

        const result = await newHandover.save();

        const resultPatrolReport = await newPatrolReport.save();

        if (result && resultPatrolReport) {
          console.log('Successfully added report.');
        }

        const itemReports = await DutyHandover.find({}).sort({ date: -1 });
        const itemBMI = await DutyHandover.find({
          location: 'Baitul Makmur I'
        }).sort({ date: -1 });
        const itemBMII = await DutyHandover.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        const itemJM = await DutyHandover.find({
          location: 'Jamek Mosque'
        }).sort({ date: -1 });
        const itemCM = await DutyHandover.find({
          location: 'City Mosque'
        }).sort({ date: -1 });
        const itemRS = await DutyHandover.find({
          location: 'Raudhatul Sakinah'
        }).sort({ date: -1 });

        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemReports,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'All',
            classActive1: 'active',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: 'show',
            toastMsg: 'Submit report successful!',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'All',
            classActive1: 'active',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: 'show',
            toastMsg: 'Submit report successful!',
            //role
            role: checkUser.role
          });
        }
      } else {
        const itemReports = await DutyHandover.find({}).sort({ date: -1 });
        const itemBMI = await DutyHandover.find({
          location: 'Baitul Makmur I'
        }).sort({ date: -1 });
        const itemBMII = await DutyHandover.find({
          location: 'Baitul Makmur II'
        }).sort({ date: -1 });
        const itemJM = await DutyHandover.find({
          location: 'Jamek Mosque'
        }).sort({ date: -1 });
        const itemCM = await DutyHandover.find({
          location: 'City Mosque'
        }).sort({ date: -1 });
        const itemRS = await DutyHandover.find({
          location: 'Raudhatul Sakinah'
        }).sort({ date: -1 });

        if (itemReports.length > 0) {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: itemReports,
            totalReports: itemReports.length,
            amountBMI: itemBMI.length,
            amountBMII: itemBMII.length,
            amountJM: itemJM.length,
            amountCM: itemCM.length,
            amountRS: itemRS.length,
            topNav: 'All',
            classActive1: 'active',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: 'show',
            toastMsg: 'Got existing duty handover',
            //role
            role: checkUser.role
          });
        } else {
          res.render('duty-handover-view', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            itemReports: 'There is no case report submitted yet.',
            totalReports: '0',
            amountBMI: '0',
            amountBMII: '0',
            amountJM: '0',
            amountCM: '0',
            amountRS: '0',
            topNav: 'All',
            classActive1: 'active',
            classActive2: '',
            classActive3: '',
            classActive4: '',
            classActive5: '',
            classActive6: '',
            // generated random id
            rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
            // toast alert
            toastShow: 'show',
            toastMsg: 'Got existing duty handover',
            //role
            role: checkUser.role
          });
        }
      }
    } else {
      res.render('duty-handover-submit', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        reportId: confirmRid,
        //validation
        validationShift: validationShift,
        validationLocation: validationLocation,
        validationHeadShift: validationHeadShift,
        validationNotes: validationNotes,
        validationStaffAbsent: validationStaffAbsent,
        validationSelectedNames: validationSelectedNames,
        //form name
        shift: formData.shift,
        location: formData.location,
        headShift: formData.headShift,
        notes: formData.notes,
        staffAbsent: formData.staffAbsent,
        selectedNames: selectedNames,
        //toast alert
        toastShow: 'show',
        toastMsg:
          'There is an error at your input or staff on duty is empty, please do check it again',
        //role
        role: checkUser.role
      });
    }
  });

// EDIT
app
  .get('/duty-handover/edit', async function (req, res) {
    if (req.isAuthenticated()) {
      const currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      const confirmRid = req.query.id;

      if (checkUser) {
        res.render('duty-handover-edit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: confirmRid,
          //validation
          validationShift: '',
          validationLocation: '',
          validationHeadShift: '',
          validationStaffOnDuty: '',
          validationStaffSickLeave: '',
          validationStaffAbsent: '',
          validationSelectedNames: '',
          //form name
          shift: '',
          date: '',
          location: '',
          headShift: '',
          staffOnDuty: '',
          staffSickLeave: '',
          staffAbsent: '',
          handoverShift: '',
          selectedNames: '',
          //toast alert
          toastShow: '',
          toastMsg: '',
          //role
          role: checkUser.role
        });
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/duty-handover/edit', async function (req, res) {
    var validationShift = '';
    var validationLocation = '';
    var validationHeadShift = '';
    var validationStaffAbsent = '';
    var validationSelectedNames = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const formData = req.body;

    const shift = req.body.shift;
    const location = req.body.location;
    const headShift = req.body.headShift;
    const staffAbsent = req.body.staffAbsent;
    const confirmRid = req.body.confirmRid;
    const selectedNames = req.body.selectedNames
      ? req.body.selectedNames.split(',')
      : [];

    const currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the reportType
    if (!shift || shift === '' || shift === 'Choose a shift') {
      validationShift = 'is-invalid';
    } else {
      validationShift = 'is-valid';
    }

    // Validate the location
    if (!location || location === '' || location === 'Choose a location') {
      validationLocation = 'is-invalid';
    } else {
      validationLocation = 'is-valid';
    }

    // Validate the headShift
    if (!headShift || headShift === '') {
      validationHeadShift = 'is-invalid';
    } else {
      validationHeadShift = 'is-valid';
    }

    // Validate the staffAbsent
    if (!staffAbsent || staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    // Validate the selectedNames
    if (selectedNames.length === 0) {
      validationSelectedNames = 'is-invalid';
    } else {
      validationSelectedNames = 'is-valid';
    }

    if (
      validationShift === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationHeadShift === 'is-valid' &&
      validationStaffAbsent === 'is-valid' &&
      validationSelectedNames === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const status = 'Incompleted';
      var handoverShift = '';

      // determine which shift to be handover
      if (shift === 'Shift A') {
        handoverShift = 'Shift B';
      } else if (shift === 'Shift B') {
        handoverShift = 'Shift C';
      } else if (shift === 'Shift C') {
        handoverShift = 'Shift A';
      }

      const giveLog =
        'Saya ' +
        headShift +
        ' selaku ketua syif ' +
        shift +
        ' telah menyerahkan tugas kepada selaku ketua syif, ' +
        handoverShift +
        ' dalam keadaan baik dan senarai peralatan tugas mencukupi di ' +
        location +
        ' pada tarikh ' +
        dateLocal.getDate();

      // Assuming you have the current time in the format "HHMM"
      const currentTimeNumeric = moment().format('HHmm');

      // Function to choose start shift based on the current time
      function chooseStartShift(currentTime) {
        if (currentTime >= '0700' && currentTime < '1500') {
          return '0700';
        } else if (currentTime >= '1500' && currentTime < '2300') {
          return '1500';
        } else {
          return '2300';
        }
      }

      // Determine the start shift and corresponding end time
      const startTime = chooseStartShift(currentTimeNumeric);

      // Set the end time based on the chosen start shift
      let endTime = '';
      let cycleAmount = '';

      if (startTime === '0700') {
        endTime = '1500';
      } else if (startTime === '1500') {
        endTime = '2300';
      } else if (startTime === '2300') {
        endTime = '0700';
        cycleAmount = 8;
      }

      // Calculate cycleAmount based on the index
      function calculateCycleAmount(index) {
        return cycleAmount || 4; // Use cycleAmount if defined, otherwise default to 4
      }

      // check location
      var confirmLocation = [];

      const locationMappings = {
        'Baitul Makmur I': [
          { checkpointName: 'Parameter 1', time: '', logReport: '' },
          { checkpointName: 'Parameter 2', time: '', logReport: '' },
          { checkpointName: 'Parameter 3', time: '', logReport: '' },
          { checkpointName: 'Parameter 4', time: '', logReport: '' },
          { checkpointName: 'Basement 1', time: '', logReport: '' },
          { checkpointName: 'Basement 2', time: '', logReport: '' },
          { checkpointName: 'Basement 3', time: '', logReport: '' },
          { checkpointName: 'Basement 4', time: '', logReport: '' },
          { checkpointName: 'Club House', time: '', logReport: '' },
          { checkpointName: 'Old Cafe', time: '', logReport: '' },
          { checkpointName: 'Level 4', time: '', logReport: '' },
          { checkpointName: 'Level 8', time: '', logReport: '' }
        ],
        'Baitul Makmur II': [
          { checkpointName: 'Basement 1 (a)', time: '', logReport: '' },
          { checkpointName: 'Basement 1 (b)', time: '', logReport: '' },
          { checkpointName: 'Basement 1 (c)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (a)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (b)', time: '', logReport: '' },
          { checkpointName: 'Basement 2 (c)', time: '', logReport: '' },
          { checkpointName: 'Ground Floor 1', time: '', logReport: '' },
          { checkpointName: 'Ground Floor 2', time: '', logReport: '' },
          { checkpointName: 'Level 8', time: '', logReport: '' },
          { checkpointName: 'Level 17', time: '', logReport: '' },
          { checkpointName: 'Level 5 (a)', time: '', logReport: '' },
          { checkpointName: 'Level 5 (b)', time: '', logReport: '' },
          {
            checkpointName: 'Genset Outside Building',
            time: '',
            logReport: ''
          },
          { checkpointName: 'Emergency Entrance', time: '', logReport: '' },
          { checkpointName: 'Outside Cafe 1', time: '', logReport: '' },
          { checkpointName: 'Outside Cafe 2', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 6', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 10', time: '', logReport: '' },
          { checkpointName: 'Service Lift Level 11', time: '', logReport: '' }
        ],
        'Jamek Mosque': [
          { checkpointName: 'Bilal Area', time: '', logReport: '' },
          { checkpointName: 'Mosque Tower', time: '', logReport: '' },
          { checkpointName: 'Cooling Tower', time: '', logReport: '' },
          { checkpointName: 'Mimbar Area', time: '', logReport: '' },
          { checkpointName: 'First Gate', time: '', logReport: '' }
        ],
        'City Mosque': [
          { checkpointName: 'Main Entrance', time: '', logReport: '' },
          { checkpointName: 'Gate 2', time: '', logReport: '' },
          {
            checkpointName: 'Backside Mosque (cemetery)',
            time: '',
            logReport: ''
          },
          { checkpointName: 'Muslimah Pray Area', time: '', logReport: '' }
        ],
        'Raudhatul Sakinah': [
          { checkpointName: 'Cemetery Area 1', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 2', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 3', time: '', logReport: '' },
          { checkpointName: 'Cemetery Area 4', time: '', logReport: '' },
          { checkpointName: 'Office Area 1', time: '', logReport: '' },
          { checkpointName: 'Office Area 2', time: '', logReport: '' },
          { checkpointName: 'Office Area 3', time: '', logReport: '' }
        ]
      };

      if (locationMappings.hasOwnProperty(location)) {
        confirmLocation = locationMappings[location];
      }

      // Insert fullName into each checkpoint with a blank value
      confirmLocation.map(checkpoint => ({
        ...checkpoint,
        fullName: '' // Insert the fullName (may be blank)
      }));

      // Create an array of cycles with varying amounts based on the start time
      const cycles = [];

      const cycleAmounts = {
        '0700': 4,
        1500: 4,
        2300: 8
      };

      const timeSlotOffsets = {
        '0700': 0,
        1500: 0, // No offset for '1500'
        2300: 0 // No offset for '2200'
      };

      const timeSlotIncrements = {
        '0700': 200, // 2 hours for '0700'
        1500: 200, // 2 hours for '1500'
        2300: 100 // 1 hour for '2200'
      };

      const timeSlotStartOffset = timeSlotOffsets[startTime];
      const timeSlotIncrement = timeSlotIncrements[startTime];

      for (let i = 0; i < cycleAmounts[startTime]; i++) {
        const timeSlotStart =
          (parseInt(startTime, 10) +
            i * timeSlotIncrement +
            timeSlotStartOffset) %
          2400; // Ensure time is within 24-hour format
        const timeSlotEnd = (timeSlotStart + timeSlotIncrement) % 2400;

        const currentCycleAmount = calculateCycleAmount(i + 1);

        cycles.push({
          cycleSeq: i + 1, // Insert the cycleSeq
          cycleAmount: currentCycleAmount,
          timeSlot: `${timeSlotStart.toString().padStart(4, '0')}-${timeSlotEnd
            .toString()
            .padStart(4, '0')}`,
          checkpoint: confirmLocation.map(checkpoint => ({
            ...checkpoint,
            fullName: '' // Insert the fullName (may be blank)
          }))
        });
      }

      // patrol report updated
      const editedReport = {
        reportId: confirmRid,
        type: 'Shift Member Location',
        shift: shift,
        location: location,
        status: 'Open',
        staff: selectedNames,
        shiftMember: {
          cycle: cycles
        }
      };

      const giveHandover = {
        headShift: headShift,
        handoverShift: handoverShift,
        staffAbsent: staffAbsent,
        logReport: giveLog,
        shift: shift,
        shiftMember: selectedNames
      };

      const receiveHandover = {
        shift: handoverShift
      };

      // updated duty handover
      const editedData = {
        reportId: confirmRid,
        handled: checkUser.fullname,
        status: status,
        location: location,
        give: giveHandover,
        receive: receiveHandover
      };

      const editedHandover = await DutyHandover.findOneAndUpdate(
        { reportId: confirmRid },
        { $set: editedData },
        { new: true }
      );

      const editedPatrol = await PatrolReport.findOneAndUpdate(
        { reportId: confirmRid },
        { $set: editedReport },
        { new: true }
      );

      if (editedHandover && editedPatrol) {
        // Activity
        const newItemActivity = {
          time: currentTime,
          by: currentFullName,
          username: currentUser,
          type: 'Duty Handover',
          title:
            'Edited a duty handover report of ' +
            _.lowerCase(shift) +
            ' & status is ' +
            status,
          about: giveLog
        };

        const newActivity = new Activity({
          date: currentDate,
          items: newItemActivity
        });

        const findDate = await Activity.findOne({ date: currentDate });

        if (findDate) {
          findDate.items.push(newItemActivity);
          await findDate.save();
          console.log('Activity added to existing date');
        } else {
          const resultActivity = Activity.create(newActivity);

          if (resultActivity) {
            console.log('Added new activity');
          } else {
            console.log('Something is wrong');
          }
        }

        console.log(
          'Edited for duty handover and patrol report : ' + confirmRid
        );

        res.redirect('/duty-handover/details?id=' + confirmRid);
      } else {
        console.log(
          'Unsuccessful to edit duty handover and patrol report : ' + confirmRid
        );

        res.redirect('/duty-handover/edit?id=' + confirmRid);
      }
    } else {
      res.render('duty-handover-edit', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        reportId: confirmRid,
        //validation
        validationShift: validationShift,
        validationLocation: validationLocation,
        validationHeadShift: validationHeadShift,
        validationStaffAbsent: validationStaffAbsent,
        validationSelectedNames: validationSelectedNames,
        //form name
        shift: formData.shift,
        location: formData.location,
        headShift: formData.headShift,
        staffAbsent: formData.staffAbsent,
        selectedNames: selectedNames,
        //toast alert
        toastShow: 'show',
        toastMsg:
          'There is an error at your input or staff on duty is empty, please do check it again',
        //role
        role: checkUser.role
      });
    }
  });

// DETAILS
app
  .get('/duty-handover/details', async function (req, res) {
    if (req.isAuthenticated()) {
      var currentUsername = req.session.user.username;
      const checkUser = await User.findOne({ username: currentUsername });

      const reportId = req.query.id;

      if (checkUser) {
        const checkReport = await DutyHandover.findOne({
          reportId: reportId
        });

        if (checkReport.status === 'Completed') {
          res.render('duty-handover-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // duty handover details
            dutyHandover: checkReport,
            reportId: checkReport.reportId,
            giveShift: checkReport.give.shift,
            giveDate: checkReport.date,
            giveHeadShift: checkReport.give.headShift,
            giveStaffOnDuty: checkReport.give.shiftMember,
            giveStaffAbsent: checkReport.give.staffAbsent,
            receiveShift: checkReport.receive.shift,
            receiveDate: checkReport.date,
            receiveHeadShift: checkReport.receive.headShift,
            receiveStaffOnDuty: checkReport.receive.shiftMember,
            receiveStaffAbsent: checkReport.receive.staffAbsent,
            giveLog: checkReport.give.logReport,
            receiveLog: checkReport.receive.logReport,
            location: checkReport.location,
            status: checkReport.status,
            notes: checkReport.notes,
            date: checkReport.date,
            handoverShift: checkReport.give.handoverShift,
            shift: checkReport.give.shift,
            // validation
            validationHeadShift: '',
            validationStaffOnDuty: '',
            validationStaffAbsent: '',
            validationSelectedNames: '',
            //form name
            headShift: '',
            staffOnDuty: '',
            staffAbsent: '',
            selectedNames: '',
            // tab-pane
            showTabPane1: '',
            showTabPane2: '',
            showTabPane3: 'active',
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role,
            user: checkUser
          });
        } else if (checkReport.status === 'Incompleted') {
          res.render('duty-handover-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // duty handover details
            dutyHandover: checkReport,
            reportId: checkReport.reportId,
            giveShift: checkReport.give.shift,
            giveDate: checkReport.date,
            giveHeadShift: checkReport.give.headShift,
            giveStaffOnDuty: checkReport.give.shiftMember,
            giveStaffAbsent: checkReport.give.staffAbsent,
            receiveShift: checkReport.receive.shift,
            receiveDate: checkReport.date,
            receiveHeadShift: checkReport.receive.headShift,
            receiveStaffOnDuty: checkReport.receive.shiftMember,
            receiveStaffAbsent: checkReport.receive.staffAbsent,
            giveLog: checkReport.give.logReport,
            receiveLog: checkReport.receive.logReport,
            location: checkReport.location,
            status: checkReport.status,
            notes: checkReport.notes,
            date: checkReport.date,
            handoverShift: checkReport.give.handoverShift,
            shift: checkReport.give.shift,
            // validation
            validationHeadShift: '',
            validationStaffOnDuty: '',
            validationStaffAbsent: '',
            validationSelectedNames: '',
            //form name
            headShift: '',
            staffOnDuty: '',
            staffAbsent: '',
            selectedNames: '',
            // tab-pane
            showTabPane1: 'active',
            showTabPane2: '',
            showTabPane3: '',
            // toast alert
            toastShow: '',
            toastMsg: '',
            //role
            role: checkUser.role,
            user: checkUser
          });
        }
      }
    } else {
      res.redirect('/sign-in');
    }
  })
  .post('/duty-handover/details', async function (req, res) {
    // find current user using
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const reportId = req.body.confirmRid;

    // find current handover report
    const checkReport = await DutyHandover.findOne({
      reportId: reportId
    });

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const headShift = req.body.headShift;
    const staffOnDuty = req.body.staffOnDuty;
    const staffAbsent = req.body.staffAbsent;
    const selectedNames = req.body.selectedNames
      ? req.body.selectedNames.split(',')
      : [];

    var validationHeadShift = '';
    var validationStaffOnDuty = '';
    var validationStaffAbsent = '';
    var validationSelectedNames = '';

    // validation head shift
    if (headShift === '') {
      validationHeadShift = 'is-invalid';
    } else {
      validationHeadShift = 'is-valid';
    }

    // validation staff on duty
    if (staffOnDuty === '') {
      validationStaffOnDuty = 'is-invalid';
    } else {
      validationStaffOnDuty = 'is-valid';
    }

    // validation absent
    if (staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    // Validate the selectedNames
    if (selectedNames.length === 0) {
      validationSelectedNames = 'is-invalid';
    } else {
      validationSelectedNames = 'is-valid';
    }

    if (
      validationHeadShift === 'is-valid' &&
      validationStaffOnDuty === 'is-valid' &&
      validationStaffAbsent === 'is-valid' &&
      validationSelectedNames === 'is-valid'
    ) {
      console.log('Succesful!');

      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const status = 'Completed';

      const location = checkReport.location;
      const date = checkReport.date;
      const shift = checkReport.receive.shift;
      const handoverShift = checkReport.give.shift;

      const kualaLumpurTimeZoneOffset1 = 8; // Kuala Lumpur is UTC+8
      const now1 = moment().utcOffset(kualaLumpurTimeZoneOffset1 * 60); // Convert hours to minutes

      // Get the current time in the Asia/Kuala_Lumpur timezone
      const currentTimeNumeric = now1.format('HHmm');

      const receiveLog =
        'Saya ' +
        headShift +
        ' selaku ketua syif ' +
        shift +
        ' telah menerima tugas daripada ketua syif ' +
        handoverShift +
        ' dalam keadaan baik dan senarai peralatan tugas mencukupi di ' +
        location +
        ' pada ' +
        date +
        ' , ' +
        currentTimeNumeric +
        'HRS';

      const updateReport = {
        status: 'Closed'
      };

      const receive = {
        shift: shift,
        headShift: headShift,
        staffAbsent: staffAbsent,
        handoverShift: handoverShift,
        logReport: receiveLog,
        shiftMember: selectedNames,
        time: currentTimeNumeric
      };

      const updatedData = {
        status: status,
        location: location,
        receive: receive
      };

      const updatedHandover = await DutyHandover.findOneAndUpdate(
        { reportId: reportId },
        { $set: updatedData },
        { new: true }
      );

      const updatedPatrol = await PatrolReport.findOneAndUpdate(
        { reportId: reportId },
        { $set: updateReport },
        { new: true }
      );

      if (updatedHandover && updatedPatrol) {
        console.log('Update success');

        // Activity
        const newItemActivity = {
          time: currentTime,
          by: currentFullName,
          username: currentUser,
          type: 'Duty Handover',
          title:
            'Submitted a received duty report of ' +
            shift +
            ' & status is ' +
            status +
            ' and this shift member patrol report is now closed',
          about: receiveLog
        };

        const newActivity = new Activity({
          date: currentDate,
          items: newItemActivity
        });

        const findDate = await Activity.findOne({ date: currentDate });

        if (findDate) {
          findDate.items.push(newItemActivity);
          await findDate.save();
          console.log('Activity added to existing date');
        } else {
          const resultActivity = Activity.create(newActivity);

          if (resultActivity) {
            console.log('Added new activity');
          } else {
            console.log('Something is wrong');
          }
        }

        res.redirect('/duty-handover/details?id=' + reportId);
      } else {
        console.log('Report Id are not exist');
      }
    } else {
      console.log('Unsuccessful!');
      res.render('duty-handover-details', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        // duty handover details
        dutyHandover: checkReport,
        reportId: checkReport.reportId,
        giveShift: checkReport.give.shift,
        giveDate: checkReport.date,
        giveHeadShift: checkReport.give.headShift,
        giveStaffOnDuty: checkReport.give.shiftMember,
        giveStaffAbsent: checkReport.give.staffAbsent,
        receiveShift: checkReport.receive.shift,
        receiveDate: checkReport.date,
        receiveHeadShift: checkReport.receive.headShift,
        receiveStaffOnDuty: checkReport.receive.shiftMember,
        receiveStaffAbsent: checkReport.receive.staffAbsent,
        giveLog: checkReport.give.logReport,
        receiveLog: checkReport.receive.logReport,
        location: checkReport.location,
        status: checkReport.status,
        notes: checkReport.notes,
        date: checkReport.date,
        handoverShift: checkReport.give.handoverShift,
        shift: checkReport.give.shift,
        // validation
        validationHeadShift: validationHeadShift,
        validationStaffOnDuty: validationStaffOnDuty,
        validationStaffAbsent: validationStaffAbsent,
        validationSelectedNames: validationSelectedNames,
        //form name
        headShift: headShift,
        staffOnDuty: staffOnDuty,
        staffAbsent: staffAbsent,
        selectedNames: selectedNames,
        // tab-pane
        showTabPane1: '',
        showTabPane2: 'active',
        showTabPane3: '',
        // toast alert
        toastShow: 'show',
        toastMsg:
          'There is an error, please do check your input form at received section',
        //role
        role: checkUser.role,
        user: checkUser
      });
    }
  });

// NOTES UPDATE

// SUBMIT BASED ON CUSTOM NAME LIST
app.post('/notes-update/:customNameList', async function (req, res) {
  // initialize data
  const customNameList = req.params.customNameList;
  const notes = req.body.notes;
  const reportId = req.body.confirmRid;

  // find current user
  var currentUsername = req.session.user.username;
  const checkUser = await User.findOne({ username: currentUsername });

  // initialize updated data
  const updatedData = {
    reportId: reportId,
    notes: notes
  };

  // initialize activity
  // current date time
  var currentTime = dateLocal.getCurrentTime();
  var currentDate = dateLocal.getDateYear();

  // Activity
  const newItemActivity = {
    time: currentTime,
    by: checkUser.fullName,
    username: checkUser.username,
    type: 'Duty Handover',
    title: 'Updated notes of ' + customNameList,
    about: notes
  };

  const newActivity = new Activity({
    date: currentDate,
    items: newItemActivity
  });

  const findDate = await Activity.findOne({ date: currentDate });

  if (findDate) {
    findDate.items.push(newItemActivity);
    await findDate.save();
    console.log('Activity added to existing date');
  } else {
    const resultActivity = Activity.create(newActivity);

    if (resultActivity) {
      console.log('Added new activity');
    } else {
      console.log('Something is wrong');
    }
  }

  // duty handover
  if (customNameList === 'duty-handover') {
    const updatedHandover = await DutyHandover.findOneAndUpdate(
      { reportId: reportId },
      { $set: updatedData },
      { new: true }
    );

    if (updatedHandover) {
      console.log('Update success');
      res.redirect('/duty-handover/details?id=' + reportId);
    } else {
      console.log('Report Id are not exist');
    }
  } else if (customNameList === 'shift-member') {
    const updatedHandover = await PatrolReport.findOneAndUpdate(
      { reportId: reportId },
      { $set: updatedData },
      { new: true }
    );

    if (updatedHandover) {
      console.log('Update success');
      res.redirect('/shift-member/details?id=' + reportId);
    } else {
      console.log('Report Id are not exist');
    }
  } else if (customNameList === 'case-report') {
    const updatedHandover = await CaseReport.findOneAndUpdate(
      { reportId: reportId },
      { $set: updatedData },
      { new: true }
    );

    if (updatedHandover) {
      console.log('Update success');
      res.redirect('/case-report/details?id=' + reportId);
    } else {
      console.log('Report Id are not exist');
    }
  }
});

// DOWNLOAD
app.get('/download/:fileName', async function (req, res) {
  const fileName = req.params.fileName;
  console.log(fileName);

  const file = await File.findOne({ filename: fileName });

  console.log(file);

  if (!file) {
    console.log('File are not found');
    const fileSchedule = await FileSchedule({ filename: fileName });

    console.log(fileSchedule);
    if (fileSchedule) {
      const filePath = __dirname + '/public/uploads/' + fileSchedule.filename;

      // Send the file as a response
      res.download(filePath, fileSchedule.filename);
      console.log('Downloading file schedule...');
    } else {
      console.log('Error downloading');
    }
  } else {
    const filePath = __dirname + '/public/uploads/' + file.filename;

    // Send the file as a response
    res.download(filePath, file.filename);
    console.log('Downloading file...');
  }
});

// DELETE
app.get('/delete/:reportType/:reportId', async function (req, res) {
  const reportType = req.params.reportType;
  const reportId = req.params.reportId;

  if (reportType === 'duty-handover') {
    const deleteDutyHandover = await DutyHandover.deleteOne({
      reportId: reportId
    });
    const deletePatrolReport = await PatrolReport.deleteOne({
      reportId: reportId
    });

    if (deleteDutyHandover && deletePatrolReport) {
      console.log('Delete successful on report ID: ' + reportId);

      res.redirect('/duty-handover/view');
    } else {
      console.log('Delete unsuccessful on report ID: ' + reportId);

      res.redirect('/duty-handover/view');
    }
  }
});

// SEARCH
app.get('/search', async function (req, res) {
  const query = req.query.query;

  try {
    let results;
    if (query && query.trim() !== '') {
      results = await User.find({
        fullname: { $regex: query, $options: 'i' }
      });
    } else {
      results = [];
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
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

// PORT INITIALIZATION ON CLOUD OR LOCAL (5001)
const PORT = process.env.PORT || 5001;

app.get('/cool', (req, res) => res.send(cool()));
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
