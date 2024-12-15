const mysql = require('mysql2/promise');
async function setupDatabase() {
    let connection;
    try {
        let connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.PORT,
            database: process.env.DB_NAME
        });
        console.log('Connected to database for setup');

        await dropAllTables(connection);

        let sql = `CREATE TABLE users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL
        );`;
        await connection.query(sql);
        console.log('Users table created');

        sql = `CREATE TABLE emails (
            id INT PRIMARY KEY AUTO_INCREMENT,
            senderId INT NOT NULL,
            receiverId INT NOT NULL,
            subject VARCHAR(255),
            body TEXT,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            downloadurl VARCHAR(255),
            FOREIGN KEY (senderId) REFERENCES users(id),
            FOREIGN KEY (receiverId) REFERENCES users(id)
        );`;
        await connection.query(sql);
        console.log('Emails table created');

        const initialUsers = [
            ['a@a.com', '123', 'User A'],
            ['b@b.com', 'password', 'User B'],
            ['c@c.com', 'password', 'User C'],
        ];
        sql = 'INSERT INTO users (email, password, username) VALUES ?';
        await connection.query(sql, [initialUsers]);

        const initialEmails = [
            [1, 2, 'Hello', 'Hi User B from User A'],
            [2, 1, 'Reply', 'Hello User A!'],
            [1, 3, 'Greetings', 'Hi User C from User A'],
            [3, 1, 'Reply to user A', 'Hello User A!'],
            [2, 3, 'Check-in', 'How are things going, User C?'],
            [3, 2, 'Re: Check-in', 'All good, thanks for checking in!'],
            [1, 3, 'Project Proposal', 'I like to discuss a potential project.'],
            [3, 1, 'Re: Project Proposal', 'Sounds interesting, lets set up a time.'],
        ];
        sql = 'INSERT INTO emails (senderId, receiverId, subject, body) VALUES ?';
        await connection.query(sql, [initialEmails]);
        console.log('Initial emails inserted');
    } catch (error) {
        console.error('Error setting up the database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function dropAllTables(connection) {
    const [tables] = await connection.query("SHOW TABLES");
    for (const row of tables) {
        const tableName = row[`Tables_in_${connection.config.database}`];
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`Dropped table: ${tableName}`);
    }
}

setupDatabase();
