import React from "react";
import { Chess } from "chess.js";


export default class Board extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            chess: new Chess(),
            board: [],
            pieces: [],
            files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            selectedPiece: '',
            from: '',
            availableMoves: [],
        }
    }

    fillBoard() {

        const {
            files,
            chess,
        } = this.state;

        let tempBoard = []
        let row = []

        for (let i = 0; i < 8; i++) {
            row = []
            for (let j = 0; j < 8; j++) {

                row.push({ color: (i + j) % 2, file: files[i], rank: 8 - j })
            }
            tempBoard.push(row)
        }

        this.setState({ board: tempBoard })
        this.setState({ pieces: chess.board() })

    }

    getPiece(piece) {
        return piece != null ?
            < img src={`./Icons/${piece?.color + piece?.type}.svg`} alt={`${piece?.type}`} className={piece?.color + "Piece"} />
            : null
    }

    getAvailableMoves(from) {

        const {
            files,
            chess,
        } = this.state

        let availableMovesTemp = []

        let currentMove

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {

                currentMove = chess.move({ from: from, to: files[i].concat(j + 1) })

                if (currentMove != null) {

                    availableMovesTemp.push({ f: i, r: 7 - j })
                    chess.undo()

                }
            }
        }

        this.setState({ availableMoves: availableMovesTemp })

    }

    componentDidMount() {

        this.fillBoard()
    }

    componentDidUpdate() {

        console.log(this.state)

    }


    onDragStartHandler(e, cell, rindex, cindex) {

        e.target.style.cursor = 'grabbing'


        console.log("drag", cell, rindex, cindex)
        let piece = this.state.chess.board()[cindex][rindex]

        this.setState({ selectedPiece: piece.type })
        this.setState({ from: piece.square })

        this.getAvailableMoves(piece.square)

    }

    onDragEnterHandler(e) {
        // console.log('enter')
        // e.target.style = "filter:invert(50%)"
    }

    onDragLeaveHandler(e) {
        // console.log('leave')
        // e.target.style = "filter:invert(-50%)"
    }

    onDragEndHandler(e) {

        // e.target.style = "filter:invert(-50%)"
        // console.log('end')
    }

    onDragOverHandler(e) {
        // console.log('over')
        e.preventDefault()
    }

    onDropHandler(e, cell) {

        e.preventDefault()

        const {
            from,
            chess
        } = this.state



        let to = cell.file.concat(cell.rank)


        console.log('drop', to)

        console.log('move', this.state.chess.move({ from: from, to: to }))

        this.setState({ pieces: this.state.chess.board() })

        // console.log("drop", cell)


    }


    render() {

        const {
            board,
            files,
            pieces,
            chess,
        } = this.state;


        if (board.length === 0) {
            return (<div>
                <p>
                    Board Loading...
                </p>
            </div>)
        }



        return (

            <div className="Board">
                {chess.turn() === 'w' ?
                    <div className="whiteCell Turn">turn</div> :
                    <div className="blackCell Turn">turn</div>


                }
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

                {board.map((row, fileindex) =>
                    <div key={row[0].file}>
                        {row.map((cell, rankindex) => {
                            return (

                                <div className=
                                    {

                                        (cell.color === 0 ? "whiteCell" : "blackCell")
                                            .concat(this.state.availableMoves.some(
                                                (element) => element.f == fileindex && element.r == rankindex) ? " availableMove" : "")

                                    }

                                    key={cell.file + cell.rank}

                                    onDragStart={(e) => this.onDragStartHandler(e, cell, fileindex, rankindex)}
                                    onDragEnter={(e) => this.onDragEnterHandler(e)}
                                    onDragLeave={(e) => this.onDragLeaveHandler(e)}
                                    onDragEnd={(e) => this.onDragEndHandler(e)}
                                    onDragOver={(e) => this.onDragOverHandler(e)}
                                    onDrop={(e) => this.onDropHandler(e, cell)}
                                >
                                    {this.getPiece(pieces[rankindex][fileindex])}

                                </div>

                            )
                        })}
                    </div>
                )}
            </div>

        )
    }
}