import React from "react";

export default class Chess extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            board: [],
            files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        }
    }

    fillBoard() {

        const {
            files,
        } = this.state;

        let tempBoard = []
        let row = []

        for (let i = 0; i < 8; i++) {
            row = []
            for (let j = 0; j < 8; j++) {

                row.push({ color: (i + j) % 2, file: files[j], rank: i })
            }
            tempBoard.push(row)
        }

        this.setState({ board: tempBoard })

    }


    componentDidMount() {

        this.fillBoard()
    }

    componentDidUpdate() {

        console.log("board", this.state.board)

    }

    render() {

        const {
            board,
            files
        } = this.state;


        if (board.length === 0) {
            return (<div>
                <p>
                    Board Loading...
                </p>
            </div>)
        }

        return (

            <div className="Chess">

                <div className="Coordinates">
                    <div className="Ranks">
                        {[...Array(8).keys()].reverse().map((rankNumber) =>
                            <p className="Rank" key={rankNumber + 1}>{rankNumber + 1}</p>

                        )}
                    </div>
                    <div className="Files">
                        {files.map((fileLetter) =>
                            <p className="File" key={fileLetter}>{fileLetter}</p>

                        )}
                    </div>


                </div>

                <div className="Board">
                    {board.map((row) =>
                        <div key={row[0].rank}>
                            {row.map((cell) =>
                                cell.color === 0 ? <div className="whiteCell" key={cell.file + cell.rank}></div> :
                                    <div className="blackCell" key={cell.file + cell.rank}></div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        )
    }
}