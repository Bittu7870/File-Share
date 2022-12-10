const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const File = require('../models/file');
const { v4: uuid4 } = require('uuid')

let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        const uniqueName = `${ Date.now()}-${Math.random()*1E9}${path.extname(file.originalname)}`;
        // 2165464584-1564894616489.jpg
        cb(null, uniqueName);
    }
})

const upload = multer({
    storage,
    limit: { fileSize: 1000000 * 100 }
}).single('myfile');

router.post('/', (req, resp) => {
    // Store Files
    upload(req, resp, async(err) => {
        // Validation request
        if (!req.file) {
            return resp.json({ error: 'All fields are required.' });
        }
        if (err) {
            return resp.status(500).send({ error: err.message })
        }
        // Store into Database
        const file = new File({
            filename: req.file.filename,
            uuid: uuid4(),
            path: req.file.path,
            size: req.file.size,
        });
        const response = await file.save();
        // Response -> Link
        return resp.json({ file: `${process.env.APP_BASE_URL}/files/${response.uuid}` });
        // http://localhost:3000/files/4564sdfaf-afdfd5656
    });
})

router.post('/send', async(req, resp) => {
    const { uuid, emailTo, emailFrom } = req.body;
    // Email validation
    if (!uuid || emailTo || emailFrom) {
        return resp.status(422).send({ error: 'All fields are required.' });
    }
    // Get data from database
    const file = await File.findOne({ uuid: uuid })
    if (file.sender) {
        return resp.status(422).send({ error: 'Email already sent' });
    }
    file.sender = emailFrom;
    file.receiver = emailTo;
    const response = await file.save();

    // Send Email
    const sendMail = require('../services/emailServices');
    sendMail({
        from: emailFrom,
        to: emailTo,
        subject: 'inShare file sharing',
        text: `${emailFrom} shared a file with you.`,
        html: require('../services/emailTemplate')({
            emailFrom,
            downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}?source=email`,
            size: parseInt(file.size / 1000) + ' KB',
            expires: '24 hours'
        })
    }).then(() => {
        return res.json({ success: true });
    }).catch(err => {
        return res.status(500).json({ error: 'Error in email sending.' });
    });
} catch (err) {
    return res.status(500).send({ error: 'Something went wrong.' });
}

});

module.exports = router;