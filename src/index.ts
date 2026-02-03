import express, { type Request, type Response } from "express";
const server = express();
const port = 3000;


server.get("/", (req: Request, res: Response) => {
    res.send("aneh");
    console.log(req.url);
    });

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});