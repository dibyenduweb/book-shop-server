const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware for CORS
app.use(cors());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5175"],
    optionsSuccessStatus: 200,
  })
);

// Middleware for JWT token verification
const verifyJWT = (req, res, next) => {
  const authentication = req.header("Authorization");
  if (!authentication) {
    return res.status(401).send({ message: "No token" });
  }
  const token = authentication.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
};

// Middleware to verify if the user is an admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email; 
  const query = { email: email };
  const user = await userCollection.findOne(query); 
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" }); 
  }
  next(); 
};

// Middleware to verify if the user is a seller
const verifySeller = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (user?.role !== "seller") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

app.use(express.json());

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2lr87.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const userCollection = client.db("bookShop").collection("users");
const productCollection = client.db("bookShop").collection("products");

// Function to connect to MongoDB and set up routes
const dbConnect = async () => {
  try {
    //await client.connect();
    console.log("Database Connected");

    // Get user by email
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params.email }; // This extracts the email parameter
      const user = await userCollection.findOne(query);
      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    // Insert new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.status(400).send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.status(201).send(result);
    });

    // Add product (requires JWT verification)
    app.post("/add-products", verifyJWT, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.status(201).send(result);
    });

    app.get("/allproducts", async (req, res) => {
      const { title, sort, category, brand, page = 1, limit = 9 } = req.query;

      const query = {};
      if (title) {
        query.title = { $regex: title, $options: "i" }; // Case-insensitive search for title
      }
      if (category) {
        query.category = { $regex: category, $options: "i" }; // Case-insensitive search for category
      }
      if (brand) {
        query.brand = brand;
      }

      const pageNumber = Number(page);
      const limitNumber = Number(limit);

      const sortOption = sort === "asc" ? 1 : -1;

      // Fetch the products from the database
      const products = await productCollection
        .find(query)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .sort({ price: sortOption })
        .toArray();

      // Get total product count for pagination
      const totalProducts = await productCollection.countDocuments(query);

      // Get unique brands and categories
      const categories = [...new Set(products.map((p) => p.category))];

      // Send response
      res.json({ products,categories, totalProducts });
    });

    //add Wishlist
    app.patch("/wishlist/add", async (req, res) => {
      const { userEmail, productId } = req.body;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { wishlist: new ObjectId(String(productId)) } }
      );

      
      res.send(result);
    });

//get data whislist
app.get("/wishlist/:userId", verifyJWT, async (req, res) => {

    const userId = req.params.userId;
    const user = await userCollection.findOne({ 
      _id: new ObjectId(String(userId)),
    });

    if (!user) {
      return res.send({ message: "User not found" });
    }

    const wishlist = await productCollection.find(
      {_id:{$in: user.wishlist ||[] }}
    ).toArray()


    res.send(wishlist);


});

//remove from wishlist
app.patch("/wishlist/remove", async (req, res) => {
  const { userEmail, productId } = req.body;

  const result = await userCollection.updateOne(
    { email: userEmail },
    { $pull: { wishlist: new ObjectId(String(productId)) } }
  );
  res.send(result);
});



  } catch (error) {
    console.log(error.name, error.message);
  }
};

dbConnect();

// Home route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// JWT authentication route to generate token
app.post("/authentication", async (req, res) => {
  const userEmail = req.body;
  const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {
    expiresIn: "10d", // Token expiration time
  });
  res.status(200).send({ token });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
