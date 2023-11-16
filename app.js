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
  email: String,
  phone: String
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
        currentUser: checkUser.username,
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

      const checkActivity = await Activity.find({});

      var todayDate = dateLocal.getDateYear();

      if (checkActivity.length > 0) {
        const checkItemActivity = await Activity.Activity.find({
          'items.username': username
        });
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: checkActivity,
          itemActivity: checkItemActivity,
          todayDate: todayDate
        });
      } else {
        res.render('profile', {
          currentFullName: checkUser.fullname,
          currentUser: checkUser.username,
          email: checkUser.email,
          phone: checkUser.phone,
          amountPatrol: checkPatrolReport.length,
          amountCase: checkCaseReport.length,
          amountTotalReports: checkPatrolReport.length + checkCaseReport.length,
          activity: '',
          itemActivity: '',
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

    // generate random id
    const rid = crypto.randomBytes(6).toString('hex').toUpperCase();
    console.log('Settings rid:' + rid);

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
