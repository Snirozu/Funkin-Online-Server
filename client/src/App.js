import { Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './routes/Home';
import User from './routes/User';
import { useEffect } from 'react';
import HeadBar from './HeadBar';
import Song from './routes/Song';
import Network from './routes/Network';
import Stats from './routes/Stats';

const App = () => {
  useEffect(() => {
    document.title = 'Psych Online';
  }, []);

  return (
    <div className='App'>
      <HeadBar></HeadBar>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user/:name" element={<User />} />
        <Route path="/song/:song" element={<Song />} />
        <Route path="/network" element={<Network />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </div>
  );
};

export default App;
