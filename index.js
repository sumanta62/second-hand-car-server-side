const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const stripe = require("stripe")('sk_test_51M6UPPBvGKOjb8OFzmOTVDZI4PdOfUEvRe7XeYaVP4AbnbTQEsUEUnb3rLRCW8JF4c7fJ09zgxnHurD9ZwdhiofP00iYZkhJ1j');

require('dotenv').config();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster2.cv4uqat.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {

    const carCategaryCollection = client.db("carHandler").collection("categaries");
    const microbusCollection = client.db("carHandler").collection("allCategary");
    const bookingCollection = client.db("carHandler").collection("bookings");
    const usersCollection = client.db("carHandler").collection("users");
    const addProductCollection = client.db("carHandler").collection("addProduct");
    const avaliableCollection = client.db("carHandler").collection("avaliabale");
    const paymentCollection = client.db("carHandler").collection("payment");
    const productComment = client.db("carHandler").collection("comment");


    function verifyJWT(req, res, next) {
        const authHeader = req.headers.authoraization;
        if (!authHeader) {
            return res.status(401).send('unauthrized access')
        }
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
            if (err) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            req.decoded = decoded;
            next();
        })
    }

    try {

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10d' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        app.get('/categary', async (req, res) => {
            const query = {}
            const car = carCategaryCollection.find(query);
            const categary = await car.toArray();
            res.send(categary);
        });
        app.get('/allCategary', async (req, res) => {
            const query = {}
            const car = microbusCollection.find(query);
            const categary = await car.toArray();
            res.send(categary);
        });
       
        app.get('/allCategary/:id', async (req, res) => {
             const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const service = await microbusCollection.findOne(query);
            res.send(service);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                categary_name: booking.categary_name,
                price: booking.price
            }
            const alradyBooked = await bookingCollection.find(query).toArray();
            if (alradyBooked.length) {
                const message = `Yoy alrady have a booking on ${booking.categary_name}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const booking = await bookingCollection.find(query).toArray();
            res.send(booking);
        })
// //////////////////////
      app.post('/comment', async(req, res) =>{
            const users = req.body;
            const result = await productComment.insertOne(users);
            res.send(result);
        })

        app.get('/comment', async(req, res) =>{
            const query = {}
            const result = await productComment.find(query).toArray();
            res.send(result);
        })
        app.delete('comment/:id',  async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productComment.deleteOne(query)
            res.send(result);
        })
        /////////////////////
        app.get('/orderPayment/:id', async(req, res) =>{
            const id = req.params.id;
            const query = { _id: ObjectId(id)}
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })

        app.post('/orderPayment-intent', async(req, res ) =>{
            const payment = req.body;
            const price = payment.price;
            const amount = price * 100 ;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                "payment_method_types": [
                    "card"
                  ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
              });
        })

        app.post('/payment', async(req, res) =>{
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            const id = payment.paymentId;
            const filter = {_id: ObjectId(id)}
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const updatedResult = await bookingCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })


        app.post('/users', async(req, res) =>{
            const users = req.body;
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })

        app.get('/users', async(req, res) =>{
            const query = {}
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.put('/users/admin/:id', verifyJWT,  async (req, res) => {
            const decodedEmaqil = req.decoded.email;
            const query = { email: decodedEmaqil };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        app.delete('/users/admin/:id',  async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result);
        })

        app.get('/addMyProduct', async (req, res) => {
            const query ={}
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/addProduct',  async(req, res) =>{
            const product = req.body;
            const result = await addProductCollection.insertOne(product);
            res.send(result)
        })
      
        app.get('/addProduct', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const product = await addProductCollection.find(query).toArray();
            res.send(product);
        })
        app.delete('/addProduct/:id',  async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await addProductCollection.deleteOne(query)
            res.send(result);
        })

        app.post('/available', async(req, res) =>{
            const users = req.body;
            const result = await avaliableCollection.insertOne(users);
            res.send(result);
        })

        app.get('/available', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const booking = await avaliableCollection.find(query).toArray();
            res.send(booking);
        })

        app.get('/users/seller/:user', async (req, res) => {
            const users = req.query.users;
            const decodedEmail = req.decoded.users;
            if (users !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { users: users };
            const booking = await usersCollection.find(query).toArray();
            res.send(booking);
        })

       
    }
    finally {

    }

}
run().catch(error => console.log(error))


app.get('/', (req, res) => {
    res.send('server side is runing');
})

app.listen(port, () => {
    console.log(`listener to port ${port}`);
})



