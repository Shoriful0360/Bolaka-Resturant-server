require('dotenv').config()
const express=require ('express')
const cors=require ('cors')
const app=express()
const port=process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion } = require('mongodb');
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
    await client.connect();

const menuCollection=client.db('Bolaka-resturant').collection('menu')
const reviewCollection=client.db('Bolaka-resturant').collection('reviews')
// get all menu data from sever
app.get('/menu',async(req,res)=>{
    const result=await menuCollection.find().toArray()
    res.send(result)
})

// get all review data from sever
app.get('/review',async(req,res)=>{
    const result=await reviewCollection.find().toArray()
    res.send(result)
})

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('server is running on bolaka resturant ')
})
app.listen(port,()=>{
    console.log(`port is running on ${port}`)
})