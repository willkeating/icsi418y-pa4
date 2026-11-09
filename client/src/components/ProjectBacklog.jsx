import {useEffect, useState} from "react";

function ProjectBacklog({refreshKey}){
    const [projects,setProjects] = useState([]);
    const [selectedProject,setSelectedProject] = useState("");
    const [stories,setStories] = useState([]);
    const [message,setMessage] = useState("");
    const [members,setMembers] = useState([]);
    const [title,setTitle] = useState("");
    const [description,setDescription] = useState("");
    const [priority,setPriority] = useState("Medium");
    const [assignedUser,setAssignedUser] = useState("");
    const [storyRefresh,setStoryRefresh] = useState(0);
    const [editingStory,setEditingStory] = useState(null);
    const [editTitle,setEditTitle] = useState("");
    const [editDescription,setEditDescription] = useState("");
    const [editPriority,setEditPriority] = useState("Medium");
    const [editStatus,setEditStatus] = useState("To Do");
    const [editAssignedUser,setEditAssignedUser] = useState("");

    useEffect(() => { //load all projects for the dropdown
        async function loadProjects(){
            try{
                const response = await fetch("http://localhost:9000/projects");
                if (!response.ok){
                    throw new Error("Could not load projects");
                }
                const data = await response.json();
                setProjects(data);
                setSelectedProject(current => data.some(p => p._id === current) ? current : (data[0]?._id || ""));
            }
            catch(error){
                setMessage(error.message);
            }
        }
        loadProjects();
    },[refreshKey]);

    useEffect(() => {    //load stories whenever the selected project changes
        let active = true;
        setStories([]);
        setMessage("");
        setEditingStory(null);//close editing form when backlog reloads
        if (!selectedProject){
            return;
        }
        async function loadStories(){
            try{
                const response = await fetch(
                    `http://localhost:9000/projects/${selectedProject}/stories`
                );
                const data = await response.json();

                if (!response.ok){
                    throw new Error(data.message || "Could not load stories");
                }

                if (active){
                    setStories(data);
                }
            }
            catch(error){
                if (active){
                    setMessage(error.message);
                }
            }
        }
        loadStories();
        return () => {active = false;};
    },[selectedProject,refreshKey,storyRefresh]);

    useEffect(() => {//load members for the selected project
        let active = true;
        setMembers([]);
        setTitle("");
        setDescription("");
        setPriority("Medium");
        setAssignedUser("");
        if (!selectedProject){
            return;
        }
        async function loadMembers(){
            try{
                const response = await fetch(
                    `http://localhost:9000/projects/${selectedProject}/members`
                );
                const data = await response.json();
                if (!response.ok){
                    throw new Error(data.message || "Could not load members");
                }
                if (active){
                    setMembers(data);
                }
            }
            catch(error){
                if (active){
                    setMessage(error.message);
                }
            }
        }
        loadMembers();
        return () => {active = false;};
    },[selectedProject,refreshKey]);

    async function createStory(e){
        e.preventDefault();//prevent page refresh
        setMessage("");
        try{
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories`,
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        title: title,
                        description: description,
                        priority: priority,
                        assigned_user_id: assignedUser || null
                    })
                }
            );
            const data = await response.json();
            if (!response.ok){
                throw new Error(data.message || "Could not create story");
            }
            setTitle("");//clear fields after creating story
            setDescription("");
            setPriority("Medium");
            setAssignedUser("");
            setStoryRefresh(current => current + 1);//reload backlog to show new story
        }
        catch(error){
            setMessage(error.message);
        }
    }

    function startEditing(story){//load story vals into form
        setEditingStory(story._id);
        setEditTitle(story.title);
        setEditDescription(story.description);
        setEditPriority(story.priority);
        setEditStatus(story.status);
        setEditAssignedUser(story.assigned_user_id || "");
        setMessage("");
    }

    async function saveStory(e){//save changes tostory
        e.preventDefault();
        setMessage("");
        try{
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories/${editingStory}`,
                {
                    method: "PUT",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        title: editTitle,
                        description: editDescription,
                        priority: editPriority,
                        status: editStatus,
                        assigned_user_id: editAssignedUser || null
                    })
                }
            );
            const data = await response.json();
            if (!response.ok){
                throw new Error(data.message || "Could not update story");
            }
            setEditingStory(null);//close edit
            setStoryRefresh(current => current + 1);
        }
        catch(error){
            setMessage(error.message);
        }
    }

    async function deleteStory(storyId){//ask for confirmation before deleting
        if (!window.confirm("Are you sure you want to delete this story?")){
            return;
        }
        setMessage("");
        try{
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories/${storyId}`,
                {method: "DELETE"}
            );
            const data = await response.json();
            if (!response.ok){
                throw new Error(data.message || "Could not delete story");
            }
            setEditingStory(null);//close edit form if open
            setStoryRefresh(current => current + 1);//reload backlog
        }
        catch(error){
            setMessage(error.message);
        }
    }

    return (
        <div>
            <h2>Project Backlog</h2>
            <label>Select Project: </label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                {projects.length === 0 && (
                    <option value="">No projects available</option>
                )}

                {projects.map(project =>(
                    <option key={project._id} value={project._id}>
                        {project.name}
                    </option>
                ))}
            </select>
            {message && <p>{message}</p>}
            {selectedProject && (
                <div>
                    <h3>Create User Story</h3>
                    <form onSubmit={createStory}>
                        <div>
                            <label>Title: </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label>Description: </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="As a user, I want..., so that..."
                                required
                            />
                        </div>
                        <div>
                            <label>Priority: </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label>Assigned Member: </label>
                            <select
                                value={assignedUser}
                                onChange={(e) => setAssignedUser(e.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {members.map(member => (
                                    <option key={member._id} value={member._id}>
                                        {member.username}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button type="submit">Create Story</button>
                    </form>
                </div>
            )}
            {selectedProject && stories.length === 0 && !message && (
                <p>No user stories for this project.</p>
            )}
            {stories.map(story => (
                <div key={story._id}>
                    <h3>{story.title}</h3>
                    <p>{story.description}</p>
                    <p>Priority: {story.priority}</p>
                    <p>Status: {story.status}</p>
                    <p>Assigned Member: {story.assigned_member_name}</p>

                    <button type="button" onClick={() => startEditing(story)}>
                        Edit
                    </button>
                    <button type="button" onClick={() => deleteStory(story._id)}>
                        Delete
                    </button>

                    {editingStory === story._id && (
                        <form onSubmit={saveStory}>
                            <div>
                                <label>Title: </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label>Description: </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label>Priority: </label>
                                <select
                                    value={editPriority}
                                    onChange={(e) => setEditPriority(e.target.value)}
                                >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div>
                                <label>Status: </label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Done">Done</option>
                                </select>
                            </div>

                            <div>
                                <label>Assigned Member: </label>
                                <select
                                    value={editAssignedUser}
                                    onChange={(e) => setEditAssignedUser(e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {members.map(member => (
                                        <option key={member._id} value={member._id}>
                                            {member.username}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit">Save Changes</button>
                            <button type="button" onClick={() => setEditingStory(null)}>
                                Cancel
                            </button>
                        </form>
                    )}

                    <hr/>
                </div>
            ))}
        </div>
    );
}
export default ProjectBacklog;