const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv').config(); 
const multer = require('multer');

let connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: "tuyetnhung1609",
    port: 3306,
    database: "wpr2201140060"
});
console.log('Connected to database for setup');
const app = express();
app.use(cookieParser());
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function isAuthenticated(req, res, next) {
    if (req.cookies.userId) {
        return next();  
    }
    res.status(403).send('Access denied. Sign in first please!');
}
app.get("/", (req, res) => {
    res.render("sign-in", {title: "Sign in", greeting: "Sign in to continue your preview"});
})
app.post('/', async (req, res) => {
    let user = {
        email: req.body.email,
        password: req.body.password
    }
    const qry = 'SELECT * FROM users WHERE email = ? AND password = ?'; 
    try {
        let [rs] = await connection.promise().query(qry, [user.email, user.password]);
        if (rs.length > 0) {
            const result = rs[0];
            res.cookie('userId', result.id, { httpOnly: true, maxAge: 3600000 }); 
            res.redirect(`/inbox/${result.id}?page=1`);
        } else {
            res.render("sign-in", {title: "Sign in", greeting: "Email or password is invalid"});
        }
    } catch (queryError) {
        res.send("query error");
    }
});
app.get("/inbox/:id", isAuthenticated, async (req, res) => {
    const id = req.params.id;
    const qry = 'SELECT * FROM users WHERE id = ?'; 
    const quer = 'SELECT * FROM emails where senderId = ?'; 
    let [rs] = await connection.promise().query(qry, [id]);
    let [rows] = await connection.promise().query(quer,[id]);
    const result = rs[0];

    const page = parseInt(req.query.page);
    const startEmailId = (page - 1) * 5;
    const endEmailId = startEmailId +5;
    const totalemails = rows.length;
    const totalpages = Math.ceil(totalemails/5);
    const emailsInPage = [];
    for (let i = startEmailId; i < endEmailId && i < rows.length; i++) {
        emailsInPage.push(rows[i]);
    }
    res.render("inbox", {title:"Inbox", user: result, emails: emailsInPage, currentPage: page, totalpages});
})
app.get("/outbox/:id", isAuthenticated, async (req, res) => {
    const id = req.params.id;
    const qry = 'SELECT * FROM users WHERE id = ?'; 
    const quer = 'SELECT * FROM emails where receiverId = ?'; 
    let [rs] = await connection.promise().query(qry, [id]);
    let [rows] = await connection.promise().query(quer,[id]);
    const result = rs[0];

    const page = parseInt(req.query.page);
    const startEmailId = (page - 1) * 5;
    const endEmailId = startEmailId +5;
    const totalemails = rows.length;
    const totalpages = Math.ceil(totalemails/5);
    const emailsInPage = [];
    for (let i = startEmailId; i < endEmailId && i < rows.length; i++) {
        emailsInPage.push(rows[i]);
    }
    res.render("outbox", {title:"Outbox", user: result, emails: emailsInPage, currentPage: page, totalpages});
})
app.get("/email-detail/:id/:emailId",isAuthenticated, async(req, res) => {
    const emailId = req.params.emailId;
    const id = req.params.id;
    const qr = 'select * from emails where id = ?';
    let [rows] = await connection.promise().query(qr, [emailId]);
    const row = rows[0];
    const qry = 'select * from users where id = ?';
    let [rs] = await connection.promise().query(qry, [id]);
    const result = rs[0];
    let greeting;
    if(row.downloadurl){
        greeting = `download the file: ${row.downloadurl}`;
    } else {
        greeting = "Check out emails"
    }
    res.render("email-detail", {title: "Email Details", user: result, email: row, id, emailId, greeting: greeting});
})
app.post("/compose/:id",
    multer({ dest: 'tmp/' }).single('attachment'),
    async (req, res) => {
        try { 
            const email = {
                receiver: req.body.receiver,
                subject: req.body.subject,
                message: req.body.message,
            };
            if (!email.receiver) {
                res.status(400).send("Select a receiver please.");
            }
            const sender = req.params.id;
            const qry = "select id from users where username = ?";
            let [rs] = await connection.promise().query(qry, [email.receiver]);
            const receiverId = rs[0].id;
            const downloadURL = `http://localhost:8000/download/${req.file.filename}`;
            const quer = "insert into emails (senderId, receiverId, subject, body, downloadurl) values (?,?,?,?,?)";
            await connection.promise().query(quer, [sender, receiverId, email.subject, email.message, downloadURL]);
            res.json({
                message: "Email sent successfully.",
                file: req.file || null
            });
        } catch (error) {
            console.error(error);
            if (!res.headersSent) {
                res.status(500).send("Cannot send email.");
            }
        }
});


app.get("/compose/:id", async (req, res) => {
    const qry = "select * from users";
    let [rs] = await connection.promise().query(qry);
    const id = req.params.id;
    const qr = "select * from users where id = ?;";
    const resu = await connection.promise().query(qr, [id]);
    const sender = resu[0][0].username;    
    const quer = "select * from emails order by id desc limit 1;";
    let [rows] = await connection.promise().query(quer);
    const emailId = rows[0].id + 1;
    res.render("compose", {title: "Compose", users: rs, id, emailId, greeting: `Compose a new Email, ${sender}`});
})
app.get("/sign-up", (req, res) => {
    res.render("sign-up", {title: "Sign Up", greeting: "Sign up if you do not have an account yet"});
})
app.post('/sign-up', async (req, res) => {
    let user = {
        email: req.body.email,
        password: req.body.password,
        username: req.body.username,
        passwordCheck: req.body.passwordCheck,
    }
    if (!user.email || !user.password || !user.username || !user.passwordCheck) {
        res.render("sign-up", {title: "Sign Up", greeting: "You have to fill all fields."});
    }
    const qry = 'select * from users where email = ?;'; 
    const quer = 'insert into users (username, email, password) values (?,?,?);'; 
    let [rows] = await connection.promise().query(qry, [user.email]);
    if (rows.length > 0) {
        res.render("sign-up", {title: "Sign Up", greeting: "This email has been registered already"});
    } else {
        if (user.password.length < 6) {
            res.render("sign-up", {title: "Sign Up", greeting: "Password is too short"});
        } else if (user.password !== user.passwordCheck) {
            res.render("sign-up", {title: "Sign Up", greeting: "Password is not matching"});
        } else {
            await connection.promise().query(
                quer,
                [user.username, user.email, user.password]
            );
            res.render("sign-in", {title: "Sign in", greeting: "Sign in to continue your preview"});
        }
    }
});
app.delete('/api/emails', async (req, res) => {
    const { emailIds } = req.body; 
    const qury = 'DELETE FROM emails WHERE id IN (?)';
    let [rows] = await connection.promise().query(qury, [emailIds]);
    res.send(rows[0]);
    res.status(200).json({ message: 'Emails deleted successfully.' });
  });
  // i am not sure if it works


app.listen(8000, () => console.log("http://localhost:8000/"))