import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/404');
    }, []);

    return (
        <>
            <div className="Content">
                <div className="Main">
                    <img className="PixelImg" alt="Not Found!" width={400} src='/images/notfound.png'></img>
                </div>
            </div>
        </>
    )
}

export default NotFound;