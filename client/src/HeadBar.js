import axios from 'axios';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import AvatarImg from './AvatarImg';
import { getHost, headProfileColor } from './Util';

function HeadBar() {
    const [data, setData] = useState({
        name: '',
        points: 0,
        profileHue: 250
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/network/account/me', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            }); // Replace with your API endpoint
            if (response.status !== 200) {
                throw new Error('Not logged in');
            }
            const data = response.data;
            Cookies.set('username', data.name, { sameSite: 'strict' });
            if (data.isMod) {
                Cookies.set('modmode', true, { sameSite: 'strict'});
            }
            setData(data);
            setLoading(false);
        } catch (error) {
            setError('Not logged in');
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);

    return (
        <>
            <div className="Bar">
                <a href="/">HOME</a>
                <a href="/network">NETWORK</a>
                <a href="/stats">STATS</a>
                <a href="/friends">FRIENDS</a>
                {loading ? (
                    <></>
                ) : error ? (
                    <></>
                ) : (
                    <>
                        <a className='BarProfile' id='HeadProfile' style={{backgroundColor: headProfileColor(data.profileHue)}} href={"/user/" + encodeURIComponent(data.name)}>
                            <AvatarImg className='SmallerAvatar' src={getHost() + "/api/avatar/" + btoa(data.name)}/>
                            <div className='BarProfileText'>
                                <b>Welcome, {data.name}! </b> <br></br>
                                Points: {data.points}
                            </div>
                        </a>
                    </>
                )}
            </div>
        </>
    )
}

export default HeadBar;