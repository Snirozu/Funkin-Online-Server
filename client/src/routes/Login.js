import axios from "axios";
import { useEffect, useState } from "react";
import { getHost } from "../Util";
import { useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [inCode, setInCode] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function submitEmail() {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(getHost() + '/api/auth/login', {
                email: email.trim()
            }, {
                responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return null; }
                }, validateStatus: () => true,
            });

            if (response.status === 200) {
                setInCode(true);
            }
            else {
                setError(response.data.error);
            }
        } catch (error) {
            setError(error.message);
        }

        setLoading(false);
    }

    async function submitCode() {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(getHost() + '/api/auth/login', {
                email: email.trim(),
                code: code.trim()
            }, {
                responseType: 'json', transformResponse: (body) => {
                    try { return JSON.parse(body) } catch (exc) { return null; }
                }, validateStatus: () => true,
            });

            const data = response.data;

            if (data.id && data.token) {
                Cookies.set("authid", data.id, {
                    expires: new Date(253402300000000)
                });
                Cookies.set("authtoken", data.token, {
                    expires: new Date(253402300000000)
                });
                alert('Logged In Successfully!')
                navigate('/network');
            }
            else {
                setError(response.data.error);
            }
        } catch (error) {
            setError(error.message);
        }

        setLoading(false);
    }

    useEffect(() => {
        if (error) {
            alert(error);
            setInCode(false);
        }
    }, [error]);

    return (
        <>
            <div className="Content">
                <div className="Main">
                    {loading ? (
                        <p>Loading...</p>
                    ) : !inCode ? (
                        <>
                            <p>
                                Login to the Network
                            </p>
                            <span>
                                Use your Email to login to the Psych Online Network! <br/>
                                Remember that the server will not tell you if the account is present in the system. <br/>
                                Creating a account, can only be done in the game.
                            </span>
                            <br></br>
                            <br></br>
                            <label>
                                Email: <input onChange={e => setEmail(e.target.value)} value={email} type="email" />
                            </label>
                            <br></br>
                            <br></br>
                            <button onClick={e => {
                                submitEmail();
                            }}> Login with E-Mail </button>
                        </>
                    ) : (
                        <>
                            <p>
                                Login to the Network
                            </p>
                            <span>
                                A code has been sent to your Email inbox! <br></br>
                                Check your spam if you can't find the code. <br></br>
                                Remember that the server will not tell you if this Email is present in the system.
                            </span>
                            <br></br>
                            <br></br>
                            <label>
                                Code: <input onChange={e => setCode(e.target.value)} value={code} type="text" />
                            </label>
                            <br></br>
                            <br></br>
                            <button onClick={e => {
                                submitCode();
                            }}> Login </button>
                        </>
                    )}
                </div>
                {Cookies.get('authid') || Cookies.get('authtoken') ? (<div className="Main">
                    <p>
                        ...Or Logout from the Network
                    </p>
                    <button onClick={e => {
                        Cookies.remove('authid');
                        Cookies.remove('authtoken');
                        window.location.reload();
                    }}> Logout </button>
                </div>)
                : (<></>)}
            </div>
        </>
    )
}

export default Login;
