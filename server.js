// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Database Client
const client = require('./lib/client');

// Auth
const request = require('superagent');
const ensureAuth = require('./lib/auth/ensure-auth');
const createAuthRoutes = require('./lib/auth/create-auth-routes');

const authRoutes = createAuthRoutes({
    async selectUser(email) {
        const result = await client.query(`
            SELECT id, email, hash, display_name as "displayName" 
            FROM users
            WHERE email = $1;
        `, [email]);
        return result.rows[0];
    },
    async insertUser(user, hash) {
        console.log(user);
        const result = await client.query(`
            INSERT into users (email, hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name as "displayName";
        `, [user.email, hash, user.displayName]);
        return result.rows[0];
    }
});

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// setup authentication routes
app.use('/api/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api/me', ensureAuth);

// *** API Routes ***

app.get('/api/recipes', async (req, res) => {
    try {

        const response = await request.get(`http://www.recipepuppy.com/api/?i=${req.query.search}&p=1`);
        // hard coded at 1 but can change in the future
      
        const responseObject = JSON.parse(response.text);
        // returns an array of object responses

        res.json(responseObject.results);
       
    }     
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.get('/api/me/recipes', async (req, res) => {

    try {
        const myQuery = `
        SELECT *
        FROM favorites
        WHERE user_id=$1`;

        const favorites = await client.query(myQuery, [req.user_id]);

        res.json(favorites.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

const stringHash = require('string-hash');

app.post('/api/me/favorites', async (req, res) => {
    // Add a favorite _for the calling user_
    try {
        const recipe = req.body;

        const result = await client.query(`
            INSERT INTO favorites (id, title, href, ingredients, thumbnail, user_id,)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING recipe as id, title, href, ingredients, thumbnail, user_id as "userId";
        `, [
            // this first value is a shortcoming of this API, no id
            stringHash(recipe.title),
            recipe.title,
            req.userId,
            recipe.href,
            recipe.ingredients,
            recipe.thmbnail
        ]);

        res.json(result.rows[0]);

    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/me/favorites/:id', (req, res) => {
    // Remove a favorite, by favorite id _and the calling user_
    try {
        client.query(`
            DELETE FROM favorites
            WHERE id = $1
            AND   user_id = $2;
        `, [req.params.id, req.userId]);

        res.json({ removed: true });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});