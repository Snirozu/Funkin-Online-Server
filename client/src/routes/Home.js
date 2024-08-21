function Home() {
    return (
        <div className='Content'>
            <div className="Main">
                <img className="CumImage" alt='Psych Online' src='/images/transwag.png'></img> <br />
                <p>Psych Online is a Friday Night Funkin' Multiplayer mod based on Psych Engine!</p>
                <img className="CumBigImage" alt='' src='/images/onlinePreview.gif'></img> <br />
                <hr/>
                <span className="BigText" >Downloads</span> <br/>
                <div className="Downloads">
                    <a href='https://github.com/Snirozu/Funkin-Psych-Online/releases/latest/download/windowsBuild.zip'>
                        <img alt="Windows" width={150} src='/images/windows_logo.png'></img>
                        <p>Windows</p>
                    </a>
                    <a href='https://github.com/Snirozu/Funkin-Psych-Online/releases/latest/download/linuxBuild.zip'>
                        <img alt="Linux" width={150} src='/images/linux_logo.png'></img>
                        <p>Linux</p>
                    </a>
                    <a href='https://github.com/Snirozu/Funkin-Psych-Online/releases/latest/download/macBuild.zip'>
                        <img alt="MacOS" width={150} src='/images/apfel_logo.png'></img>
                        <p>MacOS</p>
                    </a>
                </div>
                <br></br>
                <hr/>
                <p> Also check out the GameBanana page!</p>
                <a href="https://gamebanana.com/mods/479714"><img className="CumBigImage" alt='' src="https://gamebanana.com/mods/embeddables/479714?type=sd_image" /></a>
            </div>
        </div>
    );
}

export default Home;