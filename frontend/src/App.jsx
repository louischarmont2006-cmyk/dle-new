import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import VideoGames from './pages/VideoGames';
import Detail from './pages/Detail';
import GameDetail from './pages/GameDetail';
import Game from './pages/Game';
import CharactersList from './pages/CharactersList';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FriendsList from './pages/FriendsList';
import FriendProfile from './pages/FriendProfile';
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Page principale Manga */}
        <Route path="/" element={<Home />} />
        
        {/* Page principale Video Games */}
        <Route path="/video-games" element={<VideoGames />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Routes Manga/Anime */}
        <Route path="/anime/:id" element={<Detail />} />
        <Route path="/anime/:id/play" element={<Game />} />
        <Route path="/anime/:id/characters" element={<CharactersList />} />
        
        {/* Routes Video Games - NOUVELLES */}
        <Route path="/game/:id" element={<GameDetail />} />
        <Route path="/game/:id/play" element={<Game />} />
        <Route path="/game/:id/characters" element={<CharactersList />} />

        {/*Routes Amis */}
        <Route path="/friends" element={<FriendsList />} />
        <Route path="/friend/:friendId" element={<FriendProfile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App