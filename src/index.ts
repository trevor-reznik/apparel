/**
 * Apparel Web App.
 *
 * @author Christian P. Byrne
 */
import { model, Schema, connect, Model } from "mongoose";
import { json, urlencoded } from "body-parser";
import { __prod__ } from "./constants";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import "cookie-parser";
import cookieParser from "cookie-parser";

type ItemFit = "Oversized" | "Loose" | "Casual" | "Fitted" | "Tight";
type BroadCategory = "shirt" | "tshirt" | "sweater";
type MenGeneralSize =
  | "KID"
  | "XXS"
  | "XS"
  | "S"
  | "M"
  | "L"
  | "XL"
  | "XXL"
  | "XXXL"
  | "PLUS";
type WomenGeneralSize = number;
type ShoeSize = number;
type FormalSize = [number, number];

interface ItemColors {
  colors: string[];
  weights: {
    [color: string]: number;
  };
  ordered?: string[];
}

interface ItemMaterials {
  materials: string[];
  weights: {
    [material: string]: number;
  };
}

interface ItemCondition {
  material: number;
  color: number;
}

interface Item {
  // A description that it is helpful to the user -- something that they can
  // see to help them remember what the item refers to.
  description: string;
  // Broad category.
  category: BroadCategory;
  // Type of the given category.
  subCategory: string;
  // Hihgly specific type of given category.
  type: string;
  // See styles list.
  styles: string[];
  // How the item fits the user.
  fit: ItemFit;
  // TODO: Add details
  length: string;

  color: ItemColors;
  material: ItemMaterials;
  brand: string;
  rating: number;
  size: MenGeneralSize | WomenGeneralSize | ShoeSize | FormalSize;

  // Optional fields.
  purchaseLocation?: string;
  purchaseDate?: Date;
  cost?: number;

  washType?: string;
  condition?: ItemCondition;
}

const styles = [
  // https://my-brandable.com/en/blog/types-of-fashion-styles-with-pictures-b65.html
  "vintage",
  "artsy",
  "casual",
  "grunge",
  "chic",
  "bohemian",
  "sexy",
];

interface User {
  username: string;
  password: string;
}

//
// ─── DATABASE ───────────────────────────────────────────────────────────────────
//

interface Database {
  itemSchema: Schema<Item, Model<any, any, any>, undefined, any>;
  itemModel: Model<Item, {}, {}>;
  userSchema: Schema<User, Model<any, any, any>, undefined, any>;
  userModel: Model<User, {}, {}>;
  verboseMsg: (devMsg: any) => any | false;
}

class Database {
  constructor(verboseMsg: (msgPrinter: any) => void) {
    this.itemSchema = new Schema<Item>({
      description: String,
      category: String,
      subCategory: String,
      type: String,
      styles: [String],
      fit: String,
      length: String,
      color: {
        colors: [String],
        weight: {
          color: Number,
        },
        ordered: { type: [String], required: false },
      },
      material: {
        materials: [String],
        weights: {
          material: Number,
        },
      },
      brand: String,
      rating: Number,
      size: String || [Number, Number],
      purchaseLocation: { type: String, required: false },
      purchaseDate: { type: Date, required: false },
      cost: { type: Number, required: false },
      washType: { type: String, required: false },
      condition: {
        material: { type: Number, required: false },
        color: { type: Number, required: false },
      },
    });
    this.userSchema = new Schema<User>({
      username: String,
      password: String,
    });

    this.itemModel = model<Item>("item", this.itemSchema);
    this.userModel = model<User>("usre", this.userSchema);

    this.verboseMsg = verboseMsg;
  }
}

//
// ─── HTTP SERVER ────────────────────────────────────────────────────────────────
//

interface ExpressServer {
  server: express.Express;
  staticFolder: string;
  bindMiddleware: (middleware: any[]) => void;
  catch: () => void;
}

class ExpressServer {
  constructor(staticFolder = "public_html") {
    this.server = express();
    this.staticFolder = staticFolder;
  }
  bindMiddleware = (middlewareArray: any[]) => {
    this.server.use(express.static(this.staticFolder));
    this.server.use(express.json());
    for (const handler of middlewareArray) {
      this.server.use(handler);
    }
  };
  catch = () => {
    this.server.get("/", (req: Request) => {
      if (!__prod__) {
        console.dir(req);
      }
    });
  };
}

//
// ─── APP AND ROUTERS ────────────────────────────────────────────────────────────
//

// Config objects passed to app constructor.
interface DBConfig {
  name: string;
  port: number;
  modelNames: string[];
}

interface VerboseConfig {
  log: boolean;
  verboseGap: string;
  alert: (title: string) => void;
}

interface AppOptions {
  port?: number;
  ip?: string;
  mediaDir?: string;
  middleware: any[];
  verbose?: VerboseConfig;
  dbConfig: DBConfig;
}

interface App {
  // Paramaters.
  port: number;
  ip: string;
  mediaDir: string;
  verbose: VerboseConfig;
  dbConfig: DBConfig;
  // Attributes.
  db: Database;
  upload: multer.Multer;
  middleware: any[];
  http: ExpressServer;
  sessionKeys: {
    [key: string]: [number, number];
  };
}

class App {
  constructor(options: AppOptions) {
    // 1. Update config (default values unless specified).
    const config = {
      port: __prod__ ? 80 : 5000,
      ip: __prod__ ? "143.198.57.139" : "127.0.0.1",
      mediaDir: `${__dirname}/../public_html/img`,
      middleware: [],
    };
    const verboseDefault = {
      log: true,
      verboseGap: "\n\n\n\n",
      alert: (title = "section break") =>
        console.log(
          `${verboseDefault.verboseGap}___ ${title} ___ ${verboseDefault.verboseGap}`
        ),
    };
    const dbDefault = {
      name: "",
      port: 27017,
      modelNames: [],
    };
    Object.assign(verboseDefault, options.verbose);
    Object.assign(dbDefault, options.dbConfig);
    Object.assign(config, options);

    // 2. Destructure configs.
    this.verbose = verboseDefault;
    this.dbConfig = dbDefault;
    this.port = config.port;
    this.ip = config.ip;
    this.mediaDir = config.mediaDir;
    this.middleware = config.middleware;

    // 3. Construct database client.
    connect(`mongodb://localhost:${this.dbConfig.port}/${this.dbConfig.name}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).then((value: typeof import("mongoose")) => {
      if (!__prod__ && this.verbose.log) {
        this.verbose.alert("Mongoose Client Constructed");
        console.dir(value);
      }
    });

    // 4. Construct DB Resolvers/Models instance.
    this.db = new Database(this.verbose.alert);

    // 5. Construct HTTP Server
    this.http = new ExpressServer();

    // 6. Init and bind middleware to server.

    // Image uploading.
    this.upload = multer({
      dest: `${this.mediaDir}`,
    });
    // Cookie authentification.
    this.sessionKeys = {};
    setInterval(() => {
      let now = Date.now();
      for (let key in this.sessionKeys) {
        if (this.sessionKeys[key][1] < now - 10000) {
          delete this.sessionKeys[key];
        }
      }
    }, 2000);
    this.middleware.push(this.authenticate);
    this.http.bindMiddleware(this.middleware);

    // 7. Bind routers.
    this.http.server.post("/login", this.login);
    this.http.server.post("/register", this.register);

    // 8. Construct server.
    this.http.server.listen(this.port, () => {
      console.log(`listening on ${this.port} at ${this.ip}`);
    });
  }

  /**
   * Session cookie generator.
   * @param username
   * @param res
   */
  createSessionCookie = async (username: string, res: Response) => {
    let sessionKey = Math.floor(Math.random() * 10000);
    this.sessionKeys[username] = [sessionKey, Date.now()];
    res.cookie(
      "login",
      { username: username, key: sessionKey },
      { maxAge: 20000 }
    );
  };

  /**
   * Authentication middleware.
   * @param req
   * @param res
   * @param next
   */
  authenticate = (req: Request, res: Response, next: NextFunction) => {
    if (["/", "/register", "/login"].includes(req.url)) {
      next();
    } else {
      if (!__prod__ && this.verbose.log) {
        this.verbose.alert("Session Cookie");
        console.log(req.cookies);
      }
      if (Object.keys(req.cookies).length > 0) {
        if (
          this.sessionKeys[req.cookies.login.username][0] ==
          req.cookies.login.key
        ) {
          next();
        } else {
          res.send(false);
        }
      } else {
        res.send(false);
      }
    }
  };

  /**
   * Login router.
   * @param req
   * @param res
   */
  login = (req: Request, res: Response) => {
    this.db.userModel
      .find({
        username: req.body.username,
        password: req.body.password,
      })
      .then((user: User[]) => {
        if (user.length === 1) {
          this.createSessionCookie(req.body.username, res).then(() => {
            res.send(true);
          });
        } else {
          res.send(false);
        }
      });
  };

  /**
   * Register router.
   * @param req
   * @param res
   */
  register = (req: Request, res: Response) => {
    this.db.userModel
      .find({
        username: req.body.username,
        password: req.body.password,
      })
      .then((user: User[]) => {
        if (user.length > 0) {
          res.send(false);
        } else {
          let newUser = new this.db.userModel({
            username: req.body.username,
            password: req.body.password,
          });
          newUser.save().then(() => {
            this.createSessionCookie(req.body.username, res).then(() => {
              res.end();
            });
          });
        }
      });
  };
}

//
// ─── MAIN: RUN APP ──────────────────────────────────────────────────────────────
//

const config = {
  middleware: [cors(), json(), urlencoded({ extended: true }), cookieParser()],
  dbConfig: {
    name: "apparel",
    port: 27017,
    modelNames: ["item"],
  },
};
const apparel = new App(config);
