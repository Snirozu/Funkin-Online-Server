function Home() {
    return (
        <div className='Content'>
            <div className="Main">
                <img className="CumImage" alt='Psych Online' src='/images/transwag.png'></img> <br />
                <p>Psych Online is a Friday Night Funkin' Multiplayer mod based on Psych Engine!</p>
                <img className="CumBigImage" alt='' src='/images/onlinePreview.gif'></img> <br />
                <h2 >Downloads</h2> <br/>
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
                {/* <span className="BigText" >Unofficial Ports</span> <br />
                <div className="Downloads">
                    <a href=''>
                        <img alt="Android" width={150} src='/images/android_logo.png'></img>
                        <p>Android</p>
                    </a>
                    <a href=''>
                        <img alt="iOS" width={150} src='/images/apfel_logo.png'></img>
                        <p>iOS</p>
                    </a>
                </div>
                <br></br> */}
                <h3> Also check out the GameBanana page!</h3>
                <a href="https://gamebanana.com/mods/479714"><img className="CumBigImage" alt='' src="https://gamebanana.com/mods/embeddables/479714?type=sd_image" /></a>
                <br></br>
                <h5> Psych Online is a fan project not affiliated with the Psych Engine Team or Funkin' Crew  </h5>
            </div>
        </div>
    );
}

export default Home;