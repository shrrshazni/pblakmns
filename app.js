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
// const { string, check } = require('yargs');
const cool = require('cool-ascii-faces');

const mongoURI =
  'mongodb+srv://shrrshazni:protechlakmns123@cluster0.rembern.mongodb.net/sessions';

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

// HOME
app.get('/', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const selectedNamesDocument = await SelectedNames.findOne();

      if (selectedNamesDocument) {
        res.render('home', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          names: selectedNamesDocument.names
        });
      } else {
        res.render('home', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          currentProfile: checkUser.profile,
          rid: crypto.randomBytes(6).toString('hex').toUpperCase(),
          names: []
        });
      }
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
      const resetPasswordUrl =
        'https://whispering-coast-01823-a731e7840e6b.herokuapp.com/reset-password/' +
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

// // iTEM ACTIVITY SCHEMA
// const itemActivitySchema = new mongoose.Schema({
//   time: String,
//   by: String,
//   username: String,
//   type: String,
//   title: String,
//   about: String
// });

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

// PATROL SCHEMA
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
    var uploadTime = dateLocal.getCurrentTime();

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

// VIEW
app.get('/patrol-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await PatrolReport.find({}).sort({ date: -1 });
      const itemBMI = await PatrolReport.find({
        location: 'Baitul Makmur I'
      }).sort({ date: -1 });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II'
      }).sort({ date: -1 });
      const itemJM = await PatrolReport.find({ location: 'Jamek Mosque' }).sort(
        { date: -1 }
      );
      const itemCM = await PatrolReport.find({ location: 'City Mosque' }).sort({
        date: -1
      });
      const itemRS = await PatrolReport.find({
        location: 'Raudhatul Sakinah'
      }).sort({ date: -1 });

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

// VIEW CUSTOM NAME LIST BASED ON LOCATION
app.get('/patrol-report/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await PatrolReport.find({}).sort({ date: -1 });
      const itemBMI = await PatrolReport.find({
        location: 'Baitul Makmur I'
      }).sort({ date: -1 });
      const itemBMII = await PatrolReport.find({
        location: 'Baitul Makmur II'
      }).sort({ date: -1 });
      const itemJM = await PatrolReport.find({ location: 'Jamek Mosque' }).sort(
        { date: -1 }
      );
      const itemCM = await PatrolReport.find({ location: 'City Mosque' }).sort({
        date: -1
      });
      const itemRS = await PatrolReport.find({
        location: 'Raudhatul Sakinah'
      }).sort({ date: -1 });

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

// SUBMIT REPORT FORM
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
      const newItemActivity = {
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Patrol Report',
        title: 'Submitted a patrol report of ' + _.lowerCase(reportType),
        about: reportSummary
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
            const itemReports = await PatrolReport.find({}).sort({ date: -1 });
            const itemBMI = await PatrolReport.find({
              location: 'Baitul Makmur I'
            }).sort({ date: -1 });
            const itemBMII = await PatrolReport.find({
              location: 'Baitul Makmur II'
            }).sort({ date: -1 });
            const itemJM = await PatrolReport.find({
              location: 'Jamek Mosque'
            }).sort({ date: -1 });
            const itemCM = await PatrolReport.find({
              location: 'City Mosque'
            }).sort({ date: -1 });
            const itemRS = await PatrolReport.find({
              location: 'Raudhatul Sakinah'
            }).sort({ date: -1 });

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
            const itemReports = await PatrolReport.find({}).sort({ date: -1 });
            const itemBMI = await PatrolReport.find({
              location: 'Baitul Makmur I'
            }).sort({ date: -1 });
            const itemBMII = await PatrolReport.find({
              location: 'Baitul Makmur II'
            }).sort({ date: -1 });
            const itemJM = await PatrolReport.find({
              location: 'Jamek Mosque'
            }).sort({ date: -1 });
            const itemCM = await PatrolReport.find({
              location: 'City Mosque'
            }).sort({ date: -1 });
            const itemRS = await PatrolReport.find({
              location: 'Raudhatul Sakinah'
            }).sort({ date: -1 });

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

// REPORT DETAILS
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
            reportId: reportId,
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
            reportId: reportId,
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
          files: '',
          reportId: ''
        });
      }
    }
  } else {
    res.redirect('/sign-in');
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
    var uploadTime = dateLocal.getCurrentTime();

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

// VIEW
app.get('/case-report/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await CaseReport.find({
        username: checkUser.username
      }).sort({ date: -1 });
      const itemBMI = await CaseReport.find({
        location: 'Baitul Makmur I',
        username: checkUser.username
      }).sort({ date: -1 });
      const itemBMII = await CaseReport.find({
        location: 'Baitul Makmur II'
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

// VIEW CUSTOM NAME LIST BASED ON LOCATIONS
app.get('/case-report/view/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      const itemReports = await CaseReport.find({
        username: checkUser.username
      });
      const itemBMI = await CaseReport.find({
        location: 'Baitul Makmur I',
        username: checkUser.username
      });
      const itemBMII = await CaseReport.find({
        location: 'Baitul Makmur II',
        username: checkUser.username
      });
      const itemJM = await CaseReport.find({
        location: 'Jamek Mosque',
        username: checkUser.username
      });
      const itemCM = await CaseReport.find({
        location: 'City Mosque',
        username: checkUser.username
      });
      const itemRS = await CaseReport.find({
        location: 'Raudhatul Sakinah',
        username: checkUser.username
      });

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
      const newItemActivity = {
        time: currentTime,
        by: currentFullName,
        username: currentUser,
        type: 'Case Report',
        title: 'Submitted a case report of ' + _.lowerCase(reportType),
        about: reportSummary
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
        location: location,
        notes: ''
      });

      const existing = await CaseReport.findOne({ reportId: confirmRid });

      if (!existing) {
        const result = CaseReport.create(newReport);

        if (result) {
          console.log('Successfully added report.');

          const checkUser = await User.findOne({ username: currentUsername });

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
          const itemReports = await CaseReport.find({}).sort({ date: -1 });
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
            notes: checkReport.notes,
            reportId: checkReport.reportId,
            // files
            files: checkFiles
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
          notes: ''
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
    var uploadTime = dateLocal.getCurrentTime();

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
          const itemSchedules = await Schedule.find({}).sort({ startDate: -1 });
          const itemBMI = await Schedule.find({
            location: 'Baitul Makmur I'
          }).sort({ startDate: -1 });
          const itemBMII = await Schedule.find({
            location: 'Baitul Makmur II'
          }).sort({ startDate: -1 });
          const itemJM = await Schedule.find({ location: 'Jamek Mosque' }).sort(
            { startDate: -1 }
          );
          const itemCM = await Schedule.find({ location: 'City Mosque' }).sort({
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

// VIEW
app.get('/schedule', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({}).sort({ startDate: -1 });
      const itemBMI = await Schedule.find({ location: 'Baitul Makmur I' }).sort(
        { startDate: -1 }
      );
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      }).sort({ startDate: -1 });
      const itemJM = await Schedule.find({ location: 'Jamek Mosque' }).sort({
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

// VIEW CUSTOM NAME LIST BASED ON LOCATION
app.get('/schedule/:customListName', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;
    const checkUser = await User.findOne({ username: currentUsername });

    const customListName = _.upperCase(req.params.customListName);

    if (checkUser) {
      // schedules
      const itemSchedules = await Schedule.find({}).sort({ startDate: -1 });
      const itemBMI = await Schedule.find({ location: 'Baitul Makmur I' }).sort(
        { startDate: -1 }
      );
      const itemBMII = await Schedule.find({
        location: 'Baitul Makmur II'
      }).sort({ startDate: -1 });
      const itemJM = await Schedule.find({ location: 'Jamek Mosque' }).sort({
        startDate: -1
      });
      const itemCM = await Schedule.find({ location: 'City Mosque' }).sort({
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

// SHOW PROFILE
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
          todayDate: todayDate
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

// DUTY HANDOVER

// DUTY HANDOVER SCHEMA/MODEL
const dutyHandoverSchema = new mongoose.Schema({
  reportId: String,
  giveShift: String,
  giveDate: String,
  giveHeadShift: String,
  giveStaffOnDuty: {
    type: [String], // Assuming names are strings
    default: []
  },
  giveStaffSickLeave: String,
  giveStaffAbsent: String,
  receiveShift: String,
  receiveDate: String,
  receiveHeadShift: String,
  receiveStaffOnDuty: {
    type: [String], // Assuming names are strings
    default: []
  },
  receiveStaffSickLeave: String,
  receiveStaffAbsent: String,
  location: String,
  notes: String,
  status: String,
  handoverShift: String,
  giveLog: String,
  receiveLog: String
});

const DutyHandover = mongoose.model('DutyHandover', dutyHandoverSchema);

// VIEW
app.get('/duty-handover/view', async function (req, res) {
  if (req.isAuthenticated()) {
    var currentUsername = req.session.user.username;

    const checkUser = await User.findOne({ username: currentUsername });

    if (checkUser) {
      const itemReports = await DutyHandover.find({}).sort({ date: -1 });
      const itemBMI = await DutyHandover.find({
        location: 'Baitul Makmur I'
      }).sort({ date: -1 });
      const itemBMII = await DutyHandover.find({
        location: 'Baitul Makmur II'
      }).sort({ date: -1 });
      const itemJM = await DutyHandover.find({ location: 'Jamek Mosque' }).sort(
        { date: -1 }
      );
      const itemCM = await DutyHandover.find({ location: 'City Mosque' }).sort({
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
          toastMsg: ''
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
          toastMsg: ''
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
      const itemJM = await DutyHandover.find({ location: 'Jamek Mosque' }).sort(
        { date: -1 }
      );
      const itemCM = await DutyHandover.find({ location: 'City Mosque' }).sort({
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
            toastMsg: ''
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
          validationDate: '',
          validationLocation: '',
          validationHeadShift: '',
          validationStaffOnDuty: '',
          validationStaffSickLeave: '',
          validationStaffAbsent: '',
          validationNotes: '',
          validationHandoverShift: '',
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
    var validationNotes = '';
    var validationHandoverShift = '';
    var validationStaffAbsent = '';

    // current date time
    var currentTime = dateLocal.getCurrentTime();
    var currentDate = dateLocal.getDateYear();

    const formData = req.body;

    console.log(formData);

    const shift = formData.shift;
    const location = formData.location;
    const date = formData.date;
    const headShift = formData.headShift;
    const notes = formData.notes;
    const handoverShift = formData.handoverShift;
    const staffAbsent = formData.staffAbsent;
    const confirmRid = formData.reportId;

    console.log(confirmRid);

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

    // Validate the notes
    if (!notes || notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    // Validate the handoverShift
    if (!handoverShift || handoverShift === '') {
      validationHandoverShift = 'is-invalid';
    } else {
      validationHandoverShift = 'is-valid';
    }

    // Validate the handoverShift
    if (!handoverShift || handoverShift === '') {
      validationHandoverShift = 'is-invalid';
    } else {
      validationHandoverShift = 'is-valid';
    }

    // Validate the staffAbsent
    if (!staffAbsent || staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    if (
      validationShift === 'is-valid' &&
      validationDate === 'is-valid' &&
      validationLocation === 'is-valid' &&
      validationHeadShift === 'is-valid' &&
      validationNotes === 'is-valid' &&
      validationHandoverShift === 'is-valid' &&
      validationStaffAbsent === 'is-valid'
    ) {
      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const status = 'Incompleted';

      const giveLog =
        'Saya ' +
        headShift +
        ' selaku ketua syif ' +
        _.lowerCase(shift) +
        ' telah menyerahkan tugas kepada selaku ketua syif, ' +
        _.lowerCase(handoverShift) +
        ' dalam keadaan baik dan senarai peralatan tugas mencukupi di ' +
        location +
        ' pada tarikh ' +
        date;

      const newHandover = new DutyHandover({
        reportId: formData.reportId,
        giveShift: formData.shift,
        giveDate: formData.date,
        giveHeadShift: formData.headShift,
        status: status,
        notes: formData.notes,
        location: formData.location,
        giveStaffOnDuty: [],
        handoverShift: formData.handoverShift,
        giveStaffAbsent: formData.staffAbsent,
        giveLog: giveLog
      });

      const existing = await DutyHandover.findOne({
        reportId: formData.reportId
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

        if (formData.names && formData.names.length > 0) {
          // Assuming giveStaffOnDuty is an array, you can assign the names directly
          newHandover.giveStaffOnDuty = formData.names;
        }

        const result = await newHandover.save();

        if (result) {
          console.log('Successfully added report.');
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
            toastMsg: 'Submit report successful!'
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
            toastMsg: 'Submit report successful!'
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
        validationDate: validationDate,
        validationLocation: validationLocation,
        validationHeadShift: validationHeadShift,
        validationNotes: validationNotes,
        validationHandoverShift: validationHandoverShift,
        validationStaffAbsent: validationStaffAbsent,
        //form name
        shift: formData.shift,
        date: formData.date,
        location: formData.location,
        headShift: formData.headShift,
        notes: formData.notes,
        handoverShift: formData.handoverShift,
        staffAbsent: formData.staffAbsent,
        //toast alert
        toastShow: 'show',
        toastMsg:
          'There is an error at your input or staff on duty is empty, please do check it again'
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
          console.log(checkReport.status);
          res.render('duty-handover-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // duty handover details
            reportId: checkReport.reportId,
            giveShift: checkReport.giveShift,
            giveDate: checkReport.giveDate,
            giveHeadShift: checkReport.giveHeadShift,
            giveStaffOnDuty: checkReport.giveStaffOnDuty,
            giveStaffSickLeave: checkReport.giveStaffSickLeave,
            giveStaffAbsent: checkReport.giveStaffAbsent,
            receiveShift: checkReport.receiveShift,
            receiveDate: checkReport.receiveDate,
            receiveHeadShift: checkReport.receiveHeadShift,
            receiveStaffOnDuty: checkReport.receiveStaffOnDuty,
            receiveStaffSickLeave: checkReport.receiveStaffSickLeave,
            receiveStaffAbsent: checkReport.receiveStaffAbsent,
            giveLog: checkReport.giveLog,
            receiveLog: checkReport.receiveLog,
            location: checkReport.location,
            status: checkReport.status,
            notes: checkReport.notes,
            date: checkReport.giveDate,
            handoverShift: checkReport.handoverShift,
            shift: checkReport.giveShift,
            // validation
            validationHeadShift: '',
            validationStaffOnDuty: '',
            validationStaffSickLeave: '',
            validationStaffAbsent: '',
            validationNotes: '',
            //form name
            headShift: '',
            staffOnDuty: '',
            staffSickLeave: '',
            staffAbsent: '',
            // tab-pane
            showTabPane1: '',
            showTabPane2: '',
            showTabPane3: 'active',
            // toast alert
            toastShow: '',
            toastMsg: ''
          });
        } else {
          res.render('duty-handover-details', {
            currentFullName: checkUser.fullname,
            currentUser: checkUser.username,
            currentProfile: checkUser.profile,
            // duty handover details
            reportId: checkReport.reportId,
            giveShift: checkReport.giveShift,
            giveDate: checkReport.giveDate,
            giveHeadShift: checkReport.giveHeadShift,
            giveStaffOnDuty: checkReport.giveStaffOnDuty,
            giveStaffSickLeave: checkReport.giveStaffSickLeave,
            giveStaffAbsent: checkReport.giveStaffAbsent,
            receiveShift: checkReport.receiveShift,
            receiveDate: checkReport.receiveDate,
            receiveHeadShift: checkReport.receiveHeadShift,
            receiveStaffOnDuty: checkReport.receiveStaffOnDuty,
            receiveStaffSickLeave: checkReport.receiveStaffSickLeave,
            receiveStaffAbsent: checkReport.receiveStaffAbsent,
            giveLog: checkReport.giveLog,
            receiveLog: checkReport.receiveLog,
            location: checkReport.location,
            status: checkReport.status,
            notes: checkReport.notes,
            date: checkReport.giveDate,
            handoverShift: checkReport.handoverShift,
            shift: checkReport.giveShift,
            // validation
            validationHeadShift: '',
            validationStaffOnDuty: '',
            validationStaffSickLeave: '',
            validationStaffAbsent: '',
            validationNotes: '',
            //form name
            headShift: '',
            staffOnDuty: '',
            staffSickLeave: '',
            staffAbsent: '',
            // tab-pane
            showTabPane1: 'active',
            showTabPane2: '',
            showTabPane3: '',
            // toast alert
            toastShow: '',
            toastMsg: ''
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

    const shift = req.body.shift;
    const date = req.body.date;
    const location = req.body.location;
    const headShift = req.body.headShift;
    const handoverShift = req.body.handoverShift;
    const staffOnDuty = req.body.staffOnDuty;
    const staffSickLeave = req.body.staffSickLeave;
    const staffAbsent = req.body.staffAbsent;
    const notes = req.body.notes;

    var validationHeadShift = '';
    var validationStaffOnDuty = '';
    var validationStaffSickLeave = '';
    var validationStaffAbsent = '';
    var validationNotes = '';

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

    // validation staff sick leave
    if (staffSickLeave === '') {
      validationStaffSickLeave = 'is-invalid';
    } else {
      validationStaffSickLeave = 'is-valid';
    }

    // validation absent
    if (staffAbsent === '') {
      validationStaffAbsent = 'is-invalid';
    } else {
      validationStaffAbsent = 'is-valid';
    }

    // validation notes
    if (notes === '') {
      validationNotes = 'is-invalid';
    } else {
      validationNotes = 'is-valid';
    }

    if (
      validationHeadShift === 'is-valid' &&
      validationStaffOnDuty === 'is-valid' &&
      validationStaffSickLeave === 'is-valid' &&
      validationStaffAbsent === 'is-valid' &&
      validationNotes === 'is-valid'
    ) {
      console.log('Succesful!');

      const currentFullName = checkUser.fullname;
      const currentUser = checkUser.username;

      const status = 'Completed';

      const receiveLog =
        'Saya ' +
        headShift +
        ' selaku ketua syif ' +
        _.lowerCase(shift) +
        ' telah menerima tugas daripada ketua syif ' +
        _.lowerCase(handoverShift) +
        ' dalam keadaan baik dan senarai peralatan tugas mencukupi di ' +
        location +
        ' pada tarikh ' +
        date;

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

      const updatedData = {
        reportId: reportId,
        receiveShift: shift,
        receiveDate: date,
        receiveHeadShift: headShift,
        receiveStaffOnDuty: staffOnDuty,
        receiveStaffSickLeave: staffSickLeave,
        receiveStaffAbsent: staffAbsent,
        status: status,
        notes: notes,
        location: location,
        handoverShift: handoverShift,
        receiveLog: receiveLog
      };

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
    } else {
      console.log('Unsuccessful!');
      res.render('duty-handover-details', {
        currentFullName: checkUser.fullname,
        currentUser: checkUser.username,
        currentProfile: checkUser.profile,
        // duty handover details
        reportId: checkReport.reportId,
        giveShift: checkReport.giveShift,
        giveDate: checkReport.giveDate,
        giveHeadShift: checkReport.giveHeadShift,
        giveStaffOnDuty: checkReport.giveStaffOnDuty,
        giveStaffSickLeave: checkReport.giveStaffSickLeave,
        giveStaffAbsent: checkReport.giveStaffAbsent,
        receiveShift: checkReport.receiveShift,
        receiveDate: checkReport.receiveDate,
        receiveHeadShift: checkReport.receiveHeadShift,
        receiveStaffOnDuty: checkReport.receiveStaffOnDuty,
        receiveStaffSickLeave: checkReport.receiveStaffSickLeave,
        receiveStaffAbsent: checkReport.receiveStaffAbsent,
        giveLog: checkReport.giveLog,
        receiveLog: checkReport.receiveLog,
        location: checkReport.location,
        status: checkReport.status,
        notes: checkReport.notes,
        date: checkReport.giveDate,
        handoverShift: checkReport.handoverShift,
        shift: checkReport.giveShift,
        // validation
        validationHeadShift: validationHeadShift,
        validationStaffOnDuty: validationStaffOnDuty,
        validationStaffSickLeave: validationStaffSickLeave,
        validationStaffAbsent: validationStaffAbsent,
        validationNotes: validationNotes,
        //form name
        headShift: headShift,
        staffOnDuty: staffOnDuty,
        staffSickLeave: staffSickLeave,
        staffAbsent: staffAbsent,
        // tab-pane
        showTabPane1: '',
        showTabPane2: 'active',
        showTabPane3: '',
        // toast alert
        toastShow: 'show',
        toastMsg:
          'There is an error, please do check your input form at received section'
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
  } else if (customNameList === 'patrol-report') {
    const updatedHandover = await PatrolReport.findOneAndUpdate(
      { reportId: reportId },
      { $set: updatedData },
      { new: true }
    );

    if (updatedHandover) {
      console.log('Update success');
      res.redirect('/patrol-report/details?id=' + reportId);
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

  const file = await File.findOne({ filename: fileName });

  if (!file) {
    console.log('File are not found');
    const fileSchedule = await FileSchedule({ filename: fileName });

    if (fileSchedule) {
      const filePath = __dirname + '/public/uploads/' + file.filename;

      // Send the file as a response
      res.download(filePath, file.filename);
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

// SEARCH
app.get('/search', async function (req, res) {
  const query = req.query.query;

  try {
    let results;
    if (query && query.trim() !== '') {
      results = await User.find({ fullname: { $regex: query, $options: 'i' } });
    } else {
      results = [];
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// EXAMPLE SCHEMA
const SelectedNames = mongoose.model(
  'SelectedNames',
  new mongoose.Schema({
    reportId: String,
    names: [String]
  })
);

// EXAMPLE SAVE
app.post('/save', async (req, res) => {
  const { reportId, names } = req.body;

  try {
    // Find the document with selected names for the given report ID or create a new one if it doesn't exist
    let selectedNamesDocument = await DutyHandover.findOne({ reportId });
    if (!selectedNamesDocument) {
      selectedNamesDocument = new SelectedNames({ reportId });
    }

    // Add the new names to the existing array
    selectedNamesDocument.giveStaffOnDuty = [
      ...selectedNamesDocument.giveStaffOnDuty,
      ...names
    ];

    console.log(selectedNamesDocument);

    // Save the updated document
    const result = await selectedNamesDocument.save();

    res.json(result);
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
