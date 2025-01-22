require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_KEY}:${process.env.PASSWORD_KEY}@cluster0.onkli.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection = client.db('Bolaka-resturant').collection('menu')
    const reviewCollection = client.db('Bolaka-resturant').collection('reviews')
    const usersCollections = client.db('Bolaka-resturant').collection('users')
    const addToCardCollection = client.db('Bolaka-resturant').collection('addToCart')
    const paymentCollection = client.db('Bolaka-resturant').collection('payment')
    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.Secret_Key, { expiresIn: '1d' })
      res.send({ token })
    })

    // middle 
    const tokenVerify = (req, res, next) => {

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'athorized unaccess' })
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.Secret_Key, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorize access' })
        }
        req.decoded = decoded
        next()
      })
    }

    // payment intent
    app.post('/create-payment', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log("from parment ",amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment order
    app.post('/payment', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment)
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deletResult = await addToCardCollection.deleteMany(query)
      res.send({ result, deletResult })
    })
    // payment history
    app.get('/payment_history/:email', tokenVerify, async (req, res) => {
      const email = req.params.email;
      const query = { email }
      if (email !== req.decoded.email) {
        return res.status(403).send('Forbidden')
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })


    // separate menu  from payment menuId 

    app.get('/order_stats', async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds',
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItems.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray()
      res.send(result)
    })

    // verify admin

    const adminVerify = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollections.findOne(query)

      const isAdmin = user?.role === 'Admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      next()


    }




    // user information
    // todo: adminVerify
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const isExist = await usersCollections.findOne(query)

      if (isExist) {
        return res.send({ message: 'All ready have an account' })
      }
      const result = await usersCollections.insertOne(user)
      res.send(result)
    })

    // admin check
    app.get('/user/admin/:email', tokenVerify, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthrized access' })
      }
      const query = { email }
      const user = await usersCollections.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin"
      }
      res.send({ admin })
    })

    // get all user
    app.get('/users', tokenVerify, adminVerify, async (req, res) => {
      const result = await usersCollections.find().toArray()
      res.send(result)
    })

    // delet user
    // todo: adminVerify
    app.delete('/users/:id', tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollections.deleteOne(query)
      res.send(result)

    })

    // patch user
    // todo: adminVerify
    app.patch('/users/admin/:id', tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'Admin'
        }
      }
      const result = await usersCollections.updateOne(query, updatedDoc)
      res.send(result)
    })


    // get all review data from sever
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })


    // get all menu data from sever
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })

    // update menu
    app.patch('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const menu = req.body
      const updateDoc = {

      }
    })

    app.post('/menu', async (req, res) => {
      const menuCart = req.body;
      const result = await menuCollection.insertOne(menuCart)
      res.send(result)
    })

    // get add to card menu data
    app.get('/addToCard', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await menuCollection.find(query).toArray()
      res.send(result

      )
    })

    // get menu by specific id
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query)
      res.send(result)
    })
    // delet menu
    app.delete('/menu/:id', tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    // add to cart 
    app.post('/myCart', async (req, res) => {
      const myCart = req.body;
      const result = await addToCardCollection.insertOne(myCart)
      res.send(result)
    })

    // get add to cart
    app.get('/myCart/:email', async (req, res) => {
      const email = req.params.email;

      const query = { email }
      const result = await addToCardCollection.find(query).toArray()
      res.send(result)
    })

    // delet add to cart
    app.delete('/myCart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await addToCardCollection.deleteOne(query)
      res.send(result)
    })

    // admin states
    app.get('/admin_stats', tokenVerify, adminVerify, async (req, res) => {
      const users = await usersCollections.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      // this is not best way revenue generate
      // const payments=await paymentCollection.find().toArray();
      // const revenue=payments.reduce((total,payment)=>total+payment.price,0)


      // this is best way
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' }
          }
        }
      ]).toArray()

      const revenue = result.length > 0 ? result[0].totalRevenue : 0
      res.send({ users, menuItems, orders, revenue })
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running on bolaka resturant ')
})
app.listen(port, () => {
  console.log(`port is running on ${port}`)
})