import { Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './routes/Home';
import User from './routes/User';
import { useEffect } from 'react';
import HeadBar from './HeadBar';
import Song from './routes/Song';
import Network from './routes/Network';
import Stats from './routes/Stats';
import FriendArea from './routes/FriendArea';
import NotFound from './routes/NotFound';
import Search from './routes/Search';
import Leaderboard from './routes/Leaderboard';
import Login from './routes/Login';

const App = () => {
  return (
    <div className='App'>
      <HeadBar></HeadBar>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user/:name" element={<User />} />
        <Route path="/player/:name" element={<User />} />
        <Route path="/song/:song" element={<Song />} />
        <Route path="/network" element={<Network />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/friends" element={<FriendArea />} />
        <Route path="/search" element={<Search />} />
        <Route path="/top" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </div>
  );
};

export default App;
