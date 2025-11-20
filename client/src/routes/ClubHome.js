import { useEffect, useState } from "react";
import { getHost } from "../Util";
import axios from "axios";
import Cookies from 'js-cookie';
import { useNavigate } from "react-router-dom";

function ClubHome() {
    const [myClubTag, setMyClubTag] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const navigate = useNavigate();

    const [inputName, setClubName] = useState('');
    const [inputTag, setClubTag] = useState('');

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/account/club', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                },
                validateStatus: () => true,
            });

            if (response.status === 200) {
                setMyClubTag(response.data);
                navigate('/club/' + response.data);
            }
            else {
                setError(response.status);
            }
        } catch (error) {
            setError(error.message);
        }
        setLoading(false);
    };
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    async function submitData() {
        setLoading(true);
        setError(null);

        try {
            if (!window.confirm('The tag cannot be changed after club creation.\nDo you want to proceed?'))
                return;

            const response = await axios.post(getHost() + '/api/club/create', {
                name: inputName.trim(),
                tag: inputTag.trim()
            }, {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                },
                responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return null; }
                }, validateStatus: () => true
            });

            const data = response.data;

            if (response.status === 200) {
                alert('Club created successfully!')
                setMyClubTag(data);
            }
            else {
                alert(response.data.error);
                setError(404);
            }
        } catch (error) {
            setError(error.message);
        }

        setLoading(false);
    }

    if (myClubTag) {
        navigate('club/' + myClubTag);
    }

    return <>
        <div className='Content'>
            <div className="Main">
                {loading ? (
                    <p>Loading...</p>
                ) : error === 404 ? (
                    <>
                        <p>
                            Welcome to Clubs!
                        </p>
                        <span>
                            (If you want to find clubs <a href='/top/clubs'>click here</a>) <br />
                            <br></br>
                            <hr></hr>
                        </span>
                        <br></br>
                        <p>
                            Create a Club
                        </p>
                        <span>
                        Remember that you must have at least 250FP to create a club.
                        </span>
                        <br></br>
                        <br></br>
                        <label>
                            Club Name: <input type="text" onChange={e => setClubName(e.target.value)} value={inputName} /> <br></br>
                            Must be 20 characters or less.
                        </label>
                        <br></br>
                        <br></br>
                        <label>
                            Club Tag: <input type="text" onChange={e => setClubTag(e.target.value)} value={inputTag} /> <br></br>
                            Must be between 2 to 5 characters. <br></br>
                            TAGS CANNOT BE CHANGED!
                        </label>
                        <br></br>
                        <br></br>
                        <button className="FunkinButton" onClick={e => {
                            submitData();
                        }}> Create </button>
                    </>
                ) : error ? (
                    <p>Error: {error}</p>
                ) : (
                    <>
                    </>
                )}
            </div>
        </div>
    </>;
}

export default ClubHome;