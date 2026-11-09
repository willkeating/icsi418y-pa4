require('dotenv').config();// load environment file and copy key/val

const express = require("express");//load express
const cors = require("cors"); //meed cors cause dif ports
const {MongoClient, ObjectId} = require("mongodb");//need obj id to ref users and projects
const client = new MongoClient(process.env.MONGO_URI);//create obj, load conn string
const db = client.db("pa2")//set db
const users = db.collection("users");//where we store users
const projects = db.collection("projects");
const memberships = db.collection("ProjectMemberships");
const userStories = db.collection("UserStories");//store stories associated w projects
const app = express();//make express instance

app.use(express.json());//parses json into req.body =
app.use(cors());//add cors to let browser cross origin fetch

app.get("/",(req, res)=>{//if someone accesses '/' respond with server running, if runnign
    res.json({
        message: "server running"
    });
});

//signup request
app.post("/signup", async(req,res)=>{
    const {f_name,l_name,username,password } = req.body;//grab 4 fields from request


    if (!f_name||!l_name||!username||!password){//if any blank, return code 400 and msg, "missing field"
        return res.status(400).json({ message: "Missing field" });
    }

    try{//do db work, hit catch if fails
        const existingUser = await users.findOne({username: username})//check for user
        if (existingUser){//if yes, return taken
            return res.status(409).json({
                message: "Username taken"
            });
        }
        await users.insertOne({//if not taken, create user in db.
            f_name: f_name,
            l_name: l_name,
            username: username,
            password: password
        });
        res.status(201).json({//if worked, success code
            message: "Sign up successful",
        });
    }
    catch (error){//if anything fails serverside, return this
        console.log(error);
        res.status(500).json({
            message: "server error"
        });
    }
});

app.post("/login", async (req,res) =>{
    const {username, password} = req.body; //grab username and pass from request
    if (!username || !password){//if blank
        return res.status(400).json({
            message: "Missing field" });//say its blank
    }
    try{//db try catch
        const user = await users.findOne({username: username});//find user

        //incorrect/correct state checks
        if (!user){
            return res.status(401).json({
                message: "usename does not exist"
            });
        }

        if(user.password !== password){
            return res.status(401).json({
                message: "wrong password"
            });
        }

        res.status(200).json({
            message: "Login successful"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "server error"
        });
    }
});

app.get("/users", async (req,res) => {
    try {
        const allUsers = await users.find().project({password: 0}).toArray();//find all users in a collection and dont return passwords
        res.status(200).json(allUsers);
    }catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});


app.post("/projects", async (req,res) => {//create project w/ info from react
    const {name, description, status, project_lead_id} = req.body;
    if (!name || !description || !status || !project_lead_id) {//make sure we have everything
        return res.status(400).json({message: "Missing field"});
    }

    if (!ObjectId.isValid(project_lead_id)) {//make sure id is valid for mongoDB
        return res.status(400).json({message: "Invalid Project lead"});
    }
    try {
        const leadId = new ObjectId(project_lead_id);//find user in db
        const lead = await users.findOne({_id: leadId});
        if (!lead){//make sure lead exists
            return res.status(401).json({message: "project lead not found"});
        }
        const result = await projects.insertOne({name, description, status, project_lead_id: leadId});//make project amd store project leads id
        await memberships.insertOne({project_id: result.insertedId, user_id: leadId});//auto add lead to project members


        res.status(201).json({message: "project created", project_id: result.insertedId});

    } catch (error) {
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.get("/projects", async (req,res) => {
    try {
        const allProjects = await projects.find().toArray();//get all projects and put in arr.
        for (const project of allProjects) {
            const lead = await users.findOne({_id: project.project_lead_id});//use id to find user
            if (lead){
                project.project_lead_name = lead.username;//add username to project
            }
            else{
                project.project_lead_name = "unknown";
            }
        }
        res.status(200).json(allProjects);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.get("/projects/:projectId/members", async (req,res) => {
    const {projectId} = req.params;//get proj id from url
    if (!ObjectId.isValid(projectId)){//check ID validity
        return res.status(400).json({message: "Missing field"});
    }

    try{
        const id = new ObjectId(projectId);
        const project = await projects.findOne({_id: id});
        if (!project){
            return res.status(401).json({message: "project not found"});
        }

        const records = await memberships.find({project_id: id}).toArray();//get all records that belong to the project
        const memberList = [];
        for (const record of records){
            const user = await users.findOne({_id: record.user_id}, {projection: {password:0}});//look up user via id w/o password
            if (user){
                memberList.push(user);
                }
        }
        res.status(200).json(memberList);

    }
    catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.post("/projects/:projectId/members", async (req,res) => {
    const {projectId} = req.params;
    const {user_id} = req.body;
    if (!ObjectId.isValid(projectId) || typeof user_id !== "string" || !ObjectId.isValid(user_id)){
        return res.status(400).json({message: "Invalid project or user ID"});
    }

    try {
        const projectid = new ObjectId(projectId);//convert ids into mongo objectIds
        const userid = new ObjectId(user_id);
        //make sure everything exists
        const project = await projects.findOne({_id: projectid});
        if (!project) {
            return res.status(404).json({message: "project not found"});
        }

        const user = await users.findOne({_id: userid});
        if (!user) {
            return res.status(404).json({message: "user not found"});
        }

        const existing = await memberships.findOne({project_id: projectid, user_id: userid});
        if (existing) {
            return res.status(409).json({message: "User already belongs to project"});
        }

        await memberships.insertOne({project_id: projectid, user_id: userid});
        return res.status(201).json({message: "member added"});

    }
    catch (error){
        if (error.code === 11000){//11000 = index duplicate
            return res.status(409).json({message: "user already belongs to project"});
        }
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.delete("/projects/:projectId/members/:userId", async (req,res) => {//delete project user
    const {projectId, userId} = req.params;
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)){
        return res.status(400).json({message: "bad project or user ID"});
    }

    try{
        const projectid = new ObjectId(projectId);//conv. ids
        const userid = new ObjectId(userId);

        const project = await projects.findOne({_id: projectid});
        if (!project) {
            return res.status(404).json({message: "project not found"});
        }

        const user = await users.findOne({_id: userid});
        if (!user) {
            return res.status(404).json({message: "user not found"});
        }
        if (project.project_lead_id.equals(userid)){//cant remove project lead from own project
            return res.status(403).json({message: "cant remove project lead"});
        }
        const assignedStory = await userStories.findOne({//check is member has stories
            project_id: projectid,
            assigned_user_id: userid
        });
        if (assignedStory){
            return res.status(409).json({
                message: "Cant remove member with stories assigned. reassign or unassign"
            });
        }
        const result = await memberships.deleteOne({//delete the membership connecting user to proj
            project_id: projectid, user_id: userid});
        if (result.deletedCount === 0){//user not member if zero
            return res.status(404).json({message: "user not member or project"});
        }
        res.status(200).json({message: "member removed successfully"});
    }
    catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.post("/projects/:projectId/stories", async (req, res) => {//story post endpt
    const {projectId} = req.params;//get project id from url
    const {title, description, priority, assigned_user_id} = req.body;
    if (typeof title !== "string" || !title.trim()|| typeof description !== "string"||!description.trim() || !["High", "Medium", "Low"].includes(priority)) {//checkour required fields and the priority
        return res.status(400).json({message: "bad story fields"});
    }
    if (!ObjectId.isValid(projectId)){
        return res.status(400).json({message: "invalid project id"});
    }
    if (assigned_user_id != null && (typeof assigned_user_id !== "string" || !ObjectId.isValid(assigned_user_id))){
        return res.status(400).json({message: "invalid user id"});
    }

    try {
        const projectid = new ObjectId(projectId);
        const project = await projects.findOne({_id: projectid});
        if (!project){
            return res.status(404).json({message: "project not found"});
        }
        let userid = null;
        if (assigned_user_id != null){//unassigned
            userid = new ObjectId(assigned_user_id);
            const user = await users.findOne({_id: userid});
            const member = await memberships.findOne({
                project_id: projectid,
                user_id: userid
            });
            if (!user || !member){
                return res.status(400).json({message: "User is not member of project"});
            }
        }
        const result = await userStories.insertOne({//create story with default status
            project_id: projectid,
            title: title.trim(),
            description: description.trim(),
            priority: priority,
            status: "To Do",
            assigned_user_id: userid
        });
        res.status(201).json({
            message: "story created",
            story_id: result.insertedId
        });
    }
    catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

app.get("/projects/:projectId/stories", async (req, res) =>{//story get endpt
    const {projectId} = req.params;//get project id from url
    if (!ObjectId.isValid(projectId)){
        return res.status(400).json({message: "invalid project id"});
    }
    try{
        const projectid = new ObjectId(projectId);
        const project = await projects.findOne({_id: projectid});
        if (!project){
            return res.status(404).json({message: "project not found"});
        }
        const stories = await userStories.find({project_id: projectid}).toArray();//get stories for proj

        for (const story of stories){//find name foreach story
            story.assigned_member_name = "Unassigned";
            if (story.assigned_user_id){
                const user = await users.findOne({_id: story.assigned_user_id});
                if (user){
                    story.assigned_member_name = user.username;
                }
            }
        }
        res.status(200).json(stories);
    } catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});



app.put("/projects/:projectId/stories/:storyId", async (req, res) =>{//story put endpt
    const {projectId, storyId} = req.params;//get proj & story ids
    const {title, description, priority, status, assigned_user_id} = req.body;
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(storyId)){
        return res.status(400).json({message: "invalid id"});
    }
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim() || !["High", "Medium", "Low"].includes(priority) || !["To Do", "In Progress", "Done"].includes(status)){
        return res.status(400).json({message: "invalid story fields"});
    }
    if (assigned_user_id != null && (typeof assigned_user_id !== "string" || !ObjectId.isValid(assigned_user_id))){//if story is assigned check userid
        return res.status(400).json({message: "invalid id"});
    }
    try {
        const projectid = new ObjectId(projectId);
        const storyid = new ObjectId(storyId);

        const project = await projects.findOne({_id: projectid});
        if (!project){//make sure project exist
            return res.status(404).json({message: "project not found"});
        }
        const story = await userStories.findOne({//find story, check if for project
            _id: storyid,
            project_id: projectid
        });
        if (!story){
            return res.status(404).json({message: "story not found"});
        }
        let userid = null;//null means unassigne

        if (assigned_user_id != null){
            userid = new ObjectId(assigned_user_id);
            const user = await users.findOne({_id: userid});//verify assigned user exists and belongs to project
            const member = await memberships.findOne({
                project_id: projectid,
                user_id: userid
            });

            if (!user || !member){
                return res.status(400).json({message: "User is not a member of project"});
            }
        }

        //update existing story without changing its project
        await userStories.updateOne(
            {_id: storyid, project_id: projectid},{$set:{
                    title: title.trim(),
                    description: description.trim(),
                    priority: priority,
                    status: status,
                    assigned_user_id: userid
                }}
        );
        res.status(200).json({message: "story updated successfully"});
    }
    catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});



app.delete("/projects/:projectId/stories/:storyId", async (req, res) =>{//story delete endpt
    const {projectId, storyId} = req.params;//get ids
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(storyId)){//check ids are valid
        return res.status(400).json({message: "invalid id"});
    }
    try {
        const projectid = new ObjectId(projectId);
        const storyid = new ObjectId(storyId);
        const project = await projects.findOne({_id: projectid});
        if (!project){
            return res.status(404).json({message: "project not found"});
        }

        const result = await userStories.deleteOne({//delete story if user is right
            _id: storyid,
            project_id: projectid
        });

        if (result.deletedCount === 0){
            return res.status(404).json({message: "story not found"});
        }
        res.status(200).json({message: "story deleted successfully"});
    }
    catch(error){
        console.log(error);
        res.status(500).json({message: "server error"});
    }
});

async function startServer(){
    try{
        await client.connect();
        await memberships.createIndex({project_id: 1, user_id: 1}, {unique:true});
        console.log("Connected to MongoDB");
        app.listen(9000, () => {console.log("Server running on port 9000");});
    }
    catch(error){
        console.error("could not connect to MongoDB");
        console.error(error);
    }
}

startServer();
