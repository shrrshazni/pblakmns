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
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload');
const nodemailer = require('nodemailer');
// getdate
const dateLocal = require('./public/assets/js/date');
const { string, check } = require('yargs');

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
  email: String,
  phone: String,
  profile: String
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

//PAGES INITIALISATION

//HOME

app.get('/', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      res.render('home', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        rid: crypto.randomBytes(6).toString('hex').toUpperCase()
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
      const resetPasswordUrl = 'localhost:3000/reset-password/' + userId;

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

// iTEM ACTIVITY

const itemActivitySchema = new mongoose.Schema({
  time: String,
  by: String,
  username: String,
  type: String,
  title: String,
  about: String
});

const ItemActivity = mongoose.model('ItemActivity', itemActivitySchema);

// ACTIVITY
const ActivitySchema = new mongoose.Schema({
  date: String,
  items: [itemActivitySchema]
});

const Activity = mongoose.model('Activity', ActivitySchema);

// FILES

// Define a schema for your model (e.g., for storing file metadata)
const FileSchema = new mongoose.Schema({
  reportId: String,
  by: String,
  filename: String,
  path: String,
  date: String,
  fileType: String
});

const File = mongoose.model('File', FileSchema);

//PATROL REPORT SECTION

//patrol schema init
const patrolReportSchema = new mongoose.Schema({
  reportId: String,
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

// for upload report files
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
    var uploadTime = dateLocal.getCurrentTime();

    // Activity
    const newItemActivity = new ItemActivity({
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in patrol report'
    });

    const newActivity = new Activity({
      date: uploadTime,
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

    // Check if the report ID exists in the database
    const existingFile = await File.findOne({ reportId: confirmRid });

    if (!existingFile) {
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
      console.log('Files uploaded');
    } else {
      // File with the report ID already exists
      console.log('Files already uploaded');
    }
  }
});

// view
app.get('/patrol-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await PatrolReport.find({});
      const itemBMI = await PatrolReport.find({ location: 'Baitul Makmur I' });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await PatrolReport.find({ location: 'Jamek Mosque' });
      const itemCM = await PatrolReport.find({ location: 'City Mosque' });
      const itemRS = await PatrolReport.find({ location: 'Raudhatul Sakinah' });

      if (itemReports.length > 0) {
        res.render('patrol-report-view', {
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
          toastMsg: ''
        });
      } else {
        res.render('patrol-report-view', {
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
          toastMsg: ''
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// view custom name list other locations
app.get('/patrol-report/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await PatrolReport.find({});
      const itemBMI = await PatrolReport.find({ location: 'Baitul Makmur I' });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await PatrolReport.find({ location: 'Jamek Mosque' });
      const itemCM = await PatrolReport.find({ location: 'City Mosque' });
      const itemRS = await PatrolReport.find({ location: 'Raudhatul Sakinah' });

      // check customlistname
      if (customListName === 'BMI') {
        // view for baitul makmur 1
        if (itemReports.length > 0) {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        } else {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        }
      } else if (customListName === 'BMII') {
        // view for baitul makmur 2
        if (itemReports.length > 0) {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        } else {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        }
      } else if (customListName === 'JM') {
        // view for jamek mosque
        if (itemReports.length > 0) {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        } else {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        }
      } else if (customListName === 'CM') {
        // view for city mosque
        if (itemReports.length > 0) {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        } else {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        }
      } else if (customListName === 'RS') {
        // view for raudhatul sakinah
        if (itemReports.length > 0) {
          res.render('patrol-report-view', {
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
            toastMsg: ''
          });
        } else {
          res.render('patrol-report-view', {
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
            toastMsg: ''
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

//submit form
app
  .get('/patrol-report/submit', async function (req, res) {
    if (req.isAuthenticated()) {
      const currentUsername = req.session.user.username;

      const checkUser = await User.findOne({ username: currentUsername });

      const confirmRid = req.query.rid;

      if (checkUser) {
        res.render('patrol-report-submit', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportId: confirmRid,
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

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const reportType = req.body.reportType;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    const location = req.body.location;
    const date = req.body.date;
    const reportSummary = req.body.reportSummary;
    const notes = req.body.notes;

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

      // Activity
      const newItemActivity = new ItemActivity({
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Patrol Report',
        title: 'Submitted a patrol report of ' + _.lowerCase(reportType),
        about: reportSummary
      });

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

      // Patrol Report

      const newReport = new PatrolReport({
        reportId: confirmRid,
        username: currentUser,
        madeBy: currentFullName,
        type: reportType,
        start: startTime,
        end: endTime,
        date: date,
        summary: reportSummary,
        notes: notes,
        location: location
      });

      const existing = await PatrolReport.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = PatrolReport.create(newReport);

        if (result) {
          console.log('Successfully added report.');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await PatrolReport.find({});
            const itemBMI = await PatrolReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await PatrolReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await PatrolReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await PatrolReport.find({ location: 'City Mosque' });
            const itemRS = await PatrolReport.find({
              location: 'Raudhatul Sakinah'
            });

            if (itemReports.length > 0) {
              res.render('patrol-report-view', {
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
                toastMsg: 'Submit report successful!'
              });
            } else {
              res.render('patrol-report-view', {
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
                toastShow: 'show',
                toastMsg: 'Submit report successful!'
              });
            }
          }
        } else {
          console.log('Add report failed');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await PatrolReport.find({});
            const itemBMI = await PatrolReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await PatrolReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await PatrolReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await PatrolReport.find({ location: 'City Mosque' });
            const itemRS = await PatrolReport.find({
              location: 'Raudhatul Sakinah'
            });

            if (itemReports.length > 0) {
              res.render('patrol-report-view', {
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
                toastMsg: 'Add report failed!'
              });
            } else {
              res.render('patrol-report-view', {
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
                toastShow: 'show',
                toastMsg: 'Add report failed!'
              });
            }
          }
        }
      } else {
        console.log('There is existing report!');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          const itemReports = await PatrolReport.find({});
          const itemBMI = await PatrolReport.find({
            location: 'Baitul Makmur I'
          });
          const itemBMII = await PatrolReport.find({
            location: 'Baitul Makmur II'
          });
          const itemJM = await PatrolReport.find({
            location: 'Jamek Mosque'
          });
          const itemCM = await PatrolReport.find({ location: 'City Mosque' });
          const itemRS = await PatrolReport.find({
            location: 'Raudhatul Sakinah'
          });

          if (itemReports.length > 0) {
            res.render('patrol-report-view', {
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
              toastMsg: 'There is an exisitng report!'
            });
          } else {
            res.render('patrol-report-view', {
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
              toastShow: 'show',
              toastMsg: 'There is an existing report!'
            });
          }
        }
      }
    } else {
      // Render the response after the delay
      res.render('patrol-report-submit', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        //validation
        validationReportType: validationReportType,
        validationDate: validationDate,
        validationStartTime: validationStartTime,
        validationEndTime: validationEndTime,
        validationLocation: validationLocation,
        validationReportSummary: validationReportSummary,
        validationNotes: validationNotes,
        //form
        reportId: confirmRid,
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
    }
  });

//details
app.get('/patrol-report/details', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const reportId = req.query.id;

    if (checkUser) {
      const checkReport = await PatrolReport.findOne({
        reportId: reportId
      });

      if (checkReport) {
        const checkFiles = await File.find({ reportId: reportId });

        if (checkFiles.length > 0) {
          res.render('patrol-report-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            reportType: checkReport.type,
            madeBy: checkReport.madeBy,
            pbNumber: checkReport.username,
            startTime: checkReport.start,
            endTime: checkReport.end,
            reportSummary: checkReport.summary,
            notes: checkReport.notes,
            // files
            files: checkFiles
          });
        } else {
          res.render('patrol-report-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // patrol report
            reportType: checkReport.type,
            madeBy: checkReport.madeBy,
            pbNumber: checkReport.username,
            startTime: checkReport.start,
            endTime: checkReport.end,
            reportSummary: checkReport.summary,
            notes: checkReport.notes,
            // files
            files: checkFiles
          });
        }
      } else {
        res.render('patrol-report-details', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportType: '',
          madeBy: '',
          pbNumber: '',
          startTime: '',
          endTime: '',
          reportSummary: '',
          notes: '',
          files: ''
        });
      }
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
  staffOnDuty: String
});

const CaseReport = mongoose.model('CaseReport', caseReportSchema);

// for upload report files
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
    var uploadTime = dateLocal.getCurrentTime();

    // Activity
    const newItemActivity = new ItemActivity({
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in case report'
    });

    const newActivity = new Activity({
      date: uploadTime,
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

    // Check if the report ID exists in the database
    const existingFile = await File.findOne({ reportId: confirmRid });

    if (!existingFile) {
      // No file with the report ID found, proceed with file upload
      for (const file of Object.values(req.files)) {
        const uploadPath = __dirname + '/public/uploads/' + file.name;
        const pathFile = 'uploads/' + file.name;
        const todayDate = date.getDate();
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
      console.log('Files uploaded');
    } else {
      // File with the report ID already exists
      console.log('Files already uploaded');
    }
  }
});

// view
app.get('/case-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await CaseReport.find({});
      const itemBMI = await CaseReport.find({ location: 'Baitul Makmur I' });
      const itemBMII = await CaseReport.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await CaseReport.find({ location: 'Jamek Mosque' });
      const itemCM = await CaseReport.find({ location: 'City Mosque' });
      const itemRS = await CaseReport.find({ location: 'Raudhatul Sakinah' });

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
          toastMsg: ''
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
          toastMsg: ''
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// view custom name list other locations
app.get('/case-report/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await CaseReport.find({});
      const itemBMI = await CaseReport.find({ location: 'Baitul Makmur I' });
      const itemBMII = await CaseReport.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await CaseReport.find({ location: 'Jamek Mosque' });
      const itemCM = await CaseReport.find({ location: 'City Mosque' });
      const itemRS = await CaseReport.find({ location: 'Raudhatul Sakinah' });

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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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

//submit form
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
          toastMsg: ''
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
    var validationReportSummary = '';
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
    const reportSummary = req.body.reportSummary;
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

    // Validate the reportSummary
    if (!reportSummary || reportSummary === '') {
      validationReportSummary = 'is-invalid';
    } else {
      validationReportSummary = 'is-valid';
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
      validationReportSummary === 'is-valid' &&
      validationActionTaken === 'is-valid' &&
      validationEventSummary === 'is-valid' &&
      validationStaffOnDuty === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      // Activity
      const newItemActivity = new ItemActivity({
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Case Report',
        title: 'Submitted a case report of ' + _.lowerCase(reportType),
        about: reportSummary
      });

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

      const newReport = new CaseReport({
        reportId: confirmRid,
        username: currentUser,
        madeBy: currentFullName,
        type: reportType,
        time: time,
        date: date,
        summary: reportSummary,
        actionTaken: actionTaken,
        eventSummary: eventSummary,
        staffOnDuty: staffOnDuty,
        location: location
      });

      const existing = await CaseReport.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = CaseReport.create(newReport);

        if (result) {
          console.log('Successfully added report.');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await CaseReport.find({});
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await CaseReport.find({ location: 'City Mosque' });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Submit report successful!'
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
                toastMsg: 'Submit report successful!'
              });
            }
          }
        } else {
          console.log('Add report failed');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await CaseReport.find({});
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await CaseReport.find({ location: 'City Mosque' });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Add report failed!'
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
                toastMsg: 'Add report failed!'
              });
            }
          }
        }
      } else {
        console.log('There is existing report!');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          const itemReports = await CaseReport.find({});
          const itemBMI = await CaseReport.find({
            location: 'Baitul Makmur I'
          });
          const itemBMII = await CaseReport.find({
            location: 'Baitul Makmur II'
          });
          const itemJM = await CaseReport.find({
            location: 'Jamek Mosque'
          });
          const itemCM = await CaseReport.find({ location: 'City Mosque' });
          const itemRS = await CaseReport.find({
            location: 'Raudhatul Sakinah'
          });

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
              toastMsg: 'There is an exisitng report!'
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
              toastMsg: 'There is an existing report!'
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
        toastMsg: 'There is error in your input!'
      });
    }
  });

//case-report-details
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
            // files
            files: checkFiles
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
            // files
            files: checkFiles
          });
        }
      } else {
        res.render('case-report-details', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          reportType: '',
          madeBy: '',
          pbNumber: '',
          time: '',
          date: '',
          reportSummary: '',
          actionTaken: '',
          eventSummary: '',
          staffOnDuty: '',
          files: ''
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

// SCHEDULE

// schedule schema init
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

// file schedule schema init

const fileScheduleSchema = new mongoose.Schema({
  reportId: String,
  by: String,
  filename: String,
  path: String,
  date: String,
  fileType: String
});

const FileSchedule = mongoose.model('FileSchedule', fileScheduleSchema);

// schedule file upload
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
    var uploadTime = dateLocal.getCurrentTime();

    // Activity
    const newItemActivity = new ItemActivity({
      time: uploadTime,
      by: checkUser.fullname,
      username: checkUser.username,
      type: 'Upload Files',
      title: 'Addes & uploaded ' + Object.keys(req.files).length + ' files',
      about: 'Files added for attachment in schedule'
    });

    const newActivity = new Activity({
      date: uploadTime,
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

    // Check if the report ID exists in the database
    const existingFile = await FileSchedule.findOne({ reportId: confirmRid });

    if (!existingFile) {
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
      console.log('Files uploaded');
    } else {
      // File with the report ID already exists
      console.log('Files already uploaded');
    }
  }
});

// schedule submit
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
          toastMsg: ''
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
      const newItemActivity = new ItemActivity({
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
      });

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

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            // schedules
            const itemSchedules = await Schedule.find({});
            const itemBMI = await Schedule.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await Schedule.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await Schedule.find({ location: 'Jamek Mosque' });
            const itemCM = await Schedule.find({ location: 'City Mosque' });
            const itemRS = await Schedule.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Submit schedule successful!'
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
                toastMsg: 'Submit schedule successful!'
              });
            }
          }
        } else {
          // failed added report
          console.log('Report add failed!');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            // schedules
            const itemSchedules = await Schedule.find({});
            const itemBMI = await Schedule.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await Schedule.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await Schedule.find({ location: 'Jamek Mosque' });
            const itemCM = await Schedule.find({ location: 'City Mosque' });
            const itemRS = await Schedule.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Add schedule failed!'
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
                toastMsg: 'Add schedule failed!'
              });
            }
          }
        }
      } else {
        console.log('There is existing schedule.');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          // schedules
          const itemSchedules = await Schedule.find({});
          const itemBMI = await Schedule.find({
            location: 'Baitul Makmur I'
          });
          const itemBMII = await Schedule.find({
            location: 'Baitul Makmur II'
          });
          const itemJM = await Schedule.find({ location: 'Jamek Mosque' });
          const itemCM = await Schedule.find({ location: 'City Mosque' });
          const itemRS = await Schedule.find({
            location: 'Raudhatul Sakinah'
          });

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
              toastMsg: 'There is existing schedule!'
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
              toastMsg: 'There is existing schedule!'
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
        toastMsg: 'There is error in your input!'
      });
    }
  });

app.get('/schedule', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({});
      const itemBMI = await Schedule.find({ location: 'Baitul Makmur I' });
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await Schedule.find({ location: 'Jamek Mosque' });
      const itemCM = await Schedule.find({ location: 'City Mosque' });
      const itemRS = await Schedule.find({ location: 'Raudhatul Sakinah' });

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
          toastMsg: ''
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
          toastMsg: ''
        });
      }
    }
  } else {
    res.redirect('/sign-in');
  }
});

app.get('/schedule/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({});
      const itemBMI = await Schedule.find({ location: 'Baitul Makmur I' });
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      });
      const itemJM = await Schedule.find({ location: 'Jamek Mosque' });
      const itemCM = await Schedule.find({ location: 'City Mosque' });
      const itemRS = await Schedule.find({ location: 'Raudhatul Sakinah' });

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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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

//PROFILE

app.get('/social/profile', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const checkCaseReport = await CaseReport.find({
        username: checkUser.username
      });
      const checkPatrolReport = await PatrolReport.find({
        username: checkUser.username
      });

      const checkActivity = await Activity.find({
        'items.username': currentUsername
      })
        .limit(7)
        .sort({ timestamp: -1 });

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
          todayDate: todayDate
          // totalItemCount: totalItemCount
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
          todayDate: ''
          // totalItemCount: ''
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
        toastMsg: ''
      });
    }
  } else {
    res.redirect('/sign-in');
  }
});

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
              toastMsg: 'Update information succesful'
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
              toastMsg: 'Update information error'
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
            toastMsg: 'There is error in information input'
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
                  toastMsg: 'Change password successful'
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
              toastMsg: 'There is error in password input'
            });
          }
        });
      } else if (customListName === 'upload-profile') {
        if (!req.files || Object.keys(req.files).length === 0) {
          console.log('There is no files selected');
        } else {
          // find user full name
          const currentUsername = req.session.user.username;
          const checkUser = await User.findOne({ username: currentUsername });

          // date for upload
          var uploadDate = dateLocal.getDateYear();
          var uploadTime = dateLocal.getCurrentTime();

          // Activity
          const newItemActivity = new ItemActivity({
            time: uploadTime,
            by: checkUser.fullname,
            username: checkUser.username,
            type: 'Upload Profile',
            title: 'Update & uploaded profiles',
            about: 'Image added for profile image displayed'
          });

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

const dutyHandoverSchema = new mongoose.Schema({
  reportId: String,
  giveShift: String,
  giveDate: String,
  giveLocation: String,
  giveHeadShift: String,
  giveStaffOnDuty: String,
  giveStaffSickLeave: String,
  giveStaffAbsent: String,
  receiveShift: String,
  receiveDate: String,
  receiveLocation: String,
  receiveHeadShift: String,
  receiveStaffOnDuty: String,
  receiveStaffSickLeave: String,
  receiveStaffAbsent: String,
  notes: String,
  status: String
});

const DutyHandover = mongoose.model('DutyHandover', dutyHandoverSchema);

// Duty Acknowledgement
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
          validationDate: '',
          validationLocation: '',
          validationHeadShift: '',
          validationStaffOnDuty: '',
          validationStaffSickLeave: '',
          validationStaffAbsent: '',
          validationNotes: '',
          //form name
          shift: '',
          date: '',
          location: '',
          headShift: '',
          staffOnDuty: '',
          staffSickLeave: '',
          staffAbsent: '',
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
  .post('/duty-handover/submit', async function (req, res) {
    var validationShift = '';
    var validationDate = '';
    var validationLocation = '';
    var validationHeadShift = '';
    var validationStaffOnDuty = '';
    var validationStaffSickLeave = '';
    var validationStaffAbsent = '';
    var validationNotes = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const shift = req.body.shift;
    const location = req.body.location;
    const date = req.body.date;
    const headShift = req.body.headShift;
    const staffOnDuty = req.body.staffOnDuty;
    const staffSickLeave = req.body.staffSickLeave;
    const staffAbsent = req.body.staffAbsent;
    const notes = req.body.notes;

    // generated rid
    const confirmRid = req.body.confirmRid;

    const currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    // Validate the reportType
    if (!shift || shift === '') {
      validationShift = 'is-invalid';
    } else {
      validationShift = 'is-valid';
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

    // Validate the headShift
    if (!headShift || headShift === '') {
      validationHeadShift = 'is-invalid';
    } else {
      validationHeadShift = 'is-valid';
    }

    // Validate the staffOnDuty
    if (!staffOnDuty || staffOnDuty === '') {
      validationStaffOnDuty = 'is-invalid';
    } else {
      validationStaffOnDuty = 'is-valid';
    }

    // Validate the staffSickLeave
    if (!staffSickLeave || staffSickLeave === '') {
      validationStaffSickLeave = 'is-invalid';
    } else {
      validationStaffSickLeave = 'is-valid';
    }

    // Validate the staffAbsent
    if (!staffAbsent || staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    // Validate the notes
    if (!notes || notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    if (
      validationShift === 'is-valid' &&
      validationDate === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationHeadShift === 'is-valid' &&
      validationStaffOnDuty === 'is-valid' &&
      validationStaffSickLeave === 'is-valid' &&
      validationStaffAbsent === 'is-valid' &&
      validationNotes === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const status = 'Incompleted';

      // Activity
      const newItemActivity = new ItemActivity({
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Duty Handover',
        title: 'Submitted a duty handover report of ' + _.lowerCase(shift)+ '& status is' + status,
        about: notes
      });

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

      const newHandover = new DutyHandover({
        reportId : confirmRid,
        giveShift : shift,
        giveDate : date,
        giveLocation : location,
        giveHeadShift : headShift,
        giveStaffOnDuty : staffOnDuty,
        giveStaffSickLeave : staffSickLeave,
        giveStaffAbsent : staffAbsent,
        status : status,
        notes : notes
      });

      const existing = await DutyHandover.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = DutyHandover.create(newHandover);

        if (result) {
          console.log('Successfully added report.');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await CaseReport.find({});
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await CaseReport.find({ location: 'City Mosque' });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Submit report successful!'
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
                toastMsg: 'Submit report successful!'
              });
            }
          }
        } else {
          console.log('Add report failed');

          const checkUser = await User.findOne({ username: currentUsername });

          if (checkUser) {
            const itemReports = await CaseReport.find({});
            const itemBMI = await CaseReport.find({
              location: 'Baitul Makmur I'
            });
            const itemBMII = await CaseReport.find({
              location: 'Baitul Makmur II'
            });
            const itemJM = await CaseReport.find({
              location: 'Jamek Mosque'
            });
            const itemCM = await CaseReport.find({ location: 'City Mosque' });
            const itemRS = await CaseReport.find({
              location: 'Raudhatul Sakinah'
            });

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
                toastMsg: 'Add report failed!'
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
                toastMsg: 'Add report failed!'
              });
            }
          }
        }
      } else {
        console.log('There is existing report!');

        const checkUser = await User.findOne({ username: currentUsername });

        if (checkUser) {
          const itemReports = await CaseReport.find({});
          const itemBMI = await CaseReport.find({
            location: 'Baitul Makmur I'
          });
          const itemBMII = await CaseReport.find({
            location: 'Baitul Makmur II'
          });
          const itemJM = await CaseReport.find({
            location: 'Jamek Mosque'
          });
          const itemCM = await CaseReport.find({ location: 'City Mosque' });
          const itemRS = await CaseReport.find({
            location: 'Raudhatul Sakinah'
          });

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
              toastMsg: 'There is an exisitng report!'
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
              toastMsg: 'There is an existing report!'
            });
          }
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
        validationDate: validationDate,
        validationLocation: validationLocation,
        validationHeadShift: validationHeadShift,
        validationStaffOnDuty: validationStaffOnDuty,
        validationStaffSickLeave: validationStaffSickLeave,
        validationStaffAbsent: validationStaffAbsent,
        validationNotes: validationNotes,
        //form name
        shift: shift,
        date: date,
        location: location,
        headShift: headShift,
        staffOnDuty: staffOnDuty,
        staffSickLeave: staffSickLeave,
        staffAbsent: staffAbsent,
        notes: notes,
        //toast alert
        toastShow: 'show',
        toastMsg: 'There is an error at your input, please do check it again'
      });
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
