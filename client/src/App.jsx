import {useState} from "react";
import Signup from './components/Signup';
import Login from './components/Login';//grab code from signup and login
import CreateProject from './components/CreateProject';
import ProjectList from './components/ProjectList';
import ProjectMembers from './components/ProjectMembers';
import ProjectBacklog from "./components/ProjectBacklog.jsx";


function App(){
    const [refreshKey, setRefreshKey] = useState(0);

    function handleProjectCreated(){
        setRefreshKey(oldValue => oldValue + 1);
    }


  return (//render the signup and login components
      <div>
          <h1>PA3</h1>
          <Signup/>
          <Login/>
          <br/>
          <CreateProject onProjectCreated={handleProjectCreated}/>
          <br/>
          <ProjectList refreshKey={refreshKey}/>
          <br/>
          <ProjectMembers refreshKey={refreshKey}/>
          <br/>
          <ProjectBacklog refreshKey={refreshKey}/>
      </div>
  );
}

export default App;